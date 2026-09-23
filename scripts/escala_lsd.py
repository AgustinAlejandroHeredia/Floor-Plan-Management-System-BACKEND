#!/usr/bin/env python
# coding: utf-8
"""
Escala de un plano (unidad de obra por pixel) por Line Segment Detection.
Alternativa sin YOLO al pipeline de unidad_a_pixeles.py.

    LSD -> fusion de colineales -> refinado de extremos (tinta + extensiones)
    OCR 2x (una sola pasada) -> numeros -> emparejado numero/linea
    unidad_por_px por cota -> consenso robusto (mediana + MAD)

Uso:
    python escala_lsd.py --img plano.jpg [--viz salida.png]
    python escala_lsd.py --dir dataset/test/images --eval [--limite 60]
"""
import argparse, glob, json, os, re, sys
import cv2
import numpy as np

# Parser de numeros: reusa el del pipeline YOLO cuando se puede importar (ese
# modulo importa ultralytics en el tope, asi que puede no estar disponible).
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from unidad_a_pixeles import limpiar_numeros_ocr
except Exception:
    def limpiar_numeros_ocr(t):
        m = re.search(r'\d+(?:[.,]\d+)?', t.replace(' ', ''))
        return float(m.group().replace(',', '.')) if m else 0.0

# El texto de una cota es un numero y nada mas. Descarta "C12", "+16.17",
# "D409", fechas y los renglones de la caratula sin ningun otro filtro.
NUM_PURO = re.compile(r'^\d[\d.,:]*$')


# ---------------------------------------------------------------- 1. segmentos
def detectar_segmentos(gray):
    try:
        det = cv2.createLineSegmentDetector()
    except Exception:          # OpenCV 4.1-4.7: LSD deshabilitado por patente
        det = cv2.ximgproc.createFastLineDetector()
    s = det.detect(gray)
    s = s[0] if isinstance(s, tuple) else s
    return np.empty((0, 4), np.float32) if s is None else s.reshape(-1, 4)


# --------------------------------------------- 2. crecer una recta concreta
def crecer_recta(segs, p0, d, t_ref, hueco, ang_tol=2.0, off_tol=4.0):
    """Corrida de segmentos colineales con la recta (p0, d) que contiene a
    t_ref, uniendo huecos de hasta `hueco` px. Devuelve (t_lo, t_hi).

    Crecer una recta conocida en vez de fusionar las ~1300 de la imagen es lo
    que permite atar el hueco al ancho del numero en lugar de un valor fijo."""
    if len(segs) == 0:
        return t_ref, t_ref
    n = np.array([-d[1], d[0]])
    sa = np.degrees(np.arctan2(segs[:, 3] - segs[:, 1], segs[:, 2] - segs[:, 0])) % 180
    da = np.degrees(np.arctan2(d[1], d[0])) % 180
    med = (segs[:, :2] + segs[:, 2:]) / 2 - p0
    m = (np.abs(((sa - da) % 180 + 90) % 180 - 90) <= ang_tol) & (np.abs(med @ n) <= off_tol)
    if not m.any():
        return t_ref, t_ref
    P, Q = segs[m][:, :2] - p0, segs[m][:, 2:] - p0
    t = np.sort(np.stack([P @ d, Q @ d], 1), 1)
    t = t[np.argsort(t[:, 0])]
    lo, hi = t[0]
    for x, y in t[1:]:
        if x <= hi + hueco:
            hi = max(hi, y)
        elif lo - hueco <= t_ref <= hi + hueco:
            return lo, hi
        else:
            lo, hi = x, y
    return (lo, hi) if lo - hueco <= t_ref <= hi + hueco else (t_ref, t_ref)


def corredor_sucio(mask, a, b, lo=4, hi=9, paso=2.0):
    """Fraccion del lado mas limpio de la recta que tiene tinta pegada. Una cota
    corre por zona blanca; una pared trae rayado, doble linea o mobiliario al
    lado. Separa flojo (umbral 0.4: conserva 86% de las cotas y descarta 28% de
    las falsas), asi que se usa para desempatar y no para filtrar.

    ponytail: en la ablacion no movio recall ni precision (16.5% / 28.4% con y
    sin el), solo subio |err largo|<5% de 87.5% a 89.1%, o sea un caso de 64.
    Si no aparece un uso mejor, borrarlo con peso_corredor y este bloque."""
    d = b - a; L = np.hypot(*d)
    if L < 5:
        return 1.0
    d = d / L; n = np.array([-d[1], d[0]])
    H, W = mask.shape
    ts = np.arange(0, L, paso)
    pts = a + ts[:, None] * d
    peor = []
    for sg in (-1, 1):
        tocado = np.zeros(len(ts), bool)
        for k in range(lo, hi + 1):
            q = np.round(pts + sg * k * n).astype(int)
            dentro = (q[:, 0] >= 0) & (q[:, 0] < W) & (q[:, 1] >= 0) & (q[:, 1] < H)
            idx = np.where(dentro)[0]
            tocado[idx] |= mask[q[idx, 1], q[idx, 0]] > 0
        peor.append(tocado.mean())
    return float(min(peor))


# ---------------------------------------------------- 3. refinado de extremos
def _extender_por_tinta(mask, a, b, hueco_max=6, ext_max=60):
    """LSD corta antes de las puntas de flecha, que son manchas y no rectas:
    avanza sobre la direccion de la linea mientras siga habiendo tinta."""
    d = b - a; L = np.hypot(*d)
    if L < 1:
        return a, b
    d = d / L
    H, W = mask.shape

    def crecer(p, sg):
        hueco = ext = 0
        while ext < ext_max:
            ext += 1
            q = p + sg * d * ext
            x, y = int(round(q[0])), int(round(q[1]))
            if not (0 <= x < W and 0 <= y < H):
                break
            if mask[max(0, y - 2):y + 3, max(0, x - 2):x + 3].max() > 0:
                hueco = 0
            else:
                hueco += 1
                if hueco > hueco_max:
                    ext -= hueco
                    break
        return p + sg * d * max(ext, 0)

    return crecer(a, -1), crecer(b, 1)


def _ajustar_a_extension(segs, a, b, win_frac=0.15, win_min=30.0,
                         perp_deg=15, perp_tol=25.0):
    """La medida real va de linea de extension a linea de extension: ajusta cada
    punta al segmento perpendicular que cruza la cota mas cerca de ella.
    Devuelve ademas cuantas puntas quedaron ancladas (0, 1 o 2): una cota tiene
    terminacion en las dos, una pared cualquiera casi nunca."""
    d = b - a; L = np.hypot(*d)
    if L < 1 or len(segs) == 0:
        return a, b, 0
    d = d / L; n = np.array([-d[1], d[0]])
    win = max(win_min, win_frac * L)
    sa = np.degrees(np.arctan2(segs[:, 3] - segs[:, 1], segs[:, 2] - segs[:, 0])) % 180
    da = np.degrees(np.arctan2(d[1], d[0])) % 180
    sel = segs[np.abs(((sa - da) % 180) - 90) < perp_deg]
    if len(sel) == 0:
        return a, b, 0
    P, Q = sel[:, :2] - a, sel[:, 2:] - a
    tm = ((P + Q) / 2) @ d
    f1, f2 = P @ n, Q @ n
    cruza = (np.minimum(np.abs(f1), np.abs(f2)) <= perp_tol) | (f1 * f2 < 0)
    res, anclas = [], 0
    for t0 in (0.0, L):
        m = cruza & (np.abs(tm - t0) <= win)
        if m.any():
            res.append(tm[m][np.argmin(np.abs(tm[m] - t0))]); anclas += 1
        else:
            res.append(t0)
    return a + res[0] * d, a + res[1] * d, anclas


def refinar_extremos(mask, segs, a, b):
    return _ajustar_a_extension(segs, *_extender_por_tinta(mask, a, b))


# ------------------------------------------------------------------- 4. OCR
def textos_numericos(img_bgr, motor=None, conf_min=0.5, escala=2.0):
    """Una sola pasada de OCR sobre la imagen entera: mucho mas barato que
    recortar por candidato, y ademas permite emparejar despues.
    A escala nativa el texto de cota (6-16 px de alto) se pierde; a 2x el recall
    de OCR sobre el test set sube de 38% a 53%, y 3x no mejora nada y tarda 3x mas."""
    if motor is None:
        from rapidocr_onnxruntime import RapidOCR
        motor = RapidOCR()
    im = cv2.resize(img_bgr, None, fx=escala, fy=escala, interpolation=cv2.INTER_CUBIC)
    res = motor(cv2.cvtColor(im, cv2.COLOR_BGR2RGB))
    res = res[0] if isinstance(res, tuple) else res
    out = []
    for caja, txt, conf in (res or []):
        if float(conf) < conf_min or not NUM_PURO.match(txt.strip()):
            continue
        valor = limpiar_numeros_ocr(txt.replace(':', '.').rstrip('.,'))
        if valor <= 0:
            continue
        (cx, cy), (w, h), ang = cv2.minAreaRect(np.array(caja, np.float32) / escala)
        if w < h:                              # angulo del eje largo del texto
            ang, w, h = ang + 90, h, w
        out.append({"texto": txt, "valor": valor, "conf": float(conf),
                    "centro": np.array([cx, cy]), "ang": ang % 180,
                    "alto": max(h, 1.0), "ancho": max(w, 1.0)})
    return out


# ------------------------------------------- 5. de cada numero, a su recta
def _semillas(segs, t, ang_tol, dist_max):
    """Segmentos paralelos al numero y lo bastante cerca como para ser su cota,
    deduplicados por recta (angulo, offset) para no evaluar la misma dos veces."""
    if len(segs) == 0:
        return []
    sa = np.degrees(np.arctan2(segs[:, 3] - segs[:, 1], segs[:, 2] - segs[:, 0])) % 180
    par = np.abs(((sa - t["ang"]) % 180 + 90) % 180 - 90) <= ang_tol
    largo = np.hypot(segs[:, 2] - segs[:, 0], segs[:, 3] - segs[:, 1]) >= t["alto"]
    vistas, out = set(), []
    for sg, a_ in zip(segs[par & largo], sa[par & largo]):
        p0 = sg[:2]
        d = np.array([np.cos(np.radians(a_)), np.sin(np.radians(a_))])
        n = np.array([-d[1], d[0]])
        perp = (t["centro"] - p0) @ n
        if abs(perp) > dist_max:
            continue
        # la recta tiene que pasar al lado del numero, no lejos sobre la misma recta
        ts = (t["centro"] - p0) @ d
        t1, t2 = sorted([0.0, (sg[2:] - p0) @ d])
        if not (t1 - 3 * t["ancho"] <= ts <= t2 + 3 * t["ancho"]):
            continue
        clave = (round(a_ / 2), round(((p0 - t["centro"]) @ n) / 4))
        if clave in vistas:
            continue
        vistas.add(clave)
        out.append((p0, d))
    return out


def detectar_cotas(segs, mask, textos, ang_tol=15.0, dist_frac=3.0, largo_min=60.0,
                   anclas_min=2, centro_max=0.30, hueco_frac=1.5, peso_corredor=1.5):
    """Para cada numero leido busca su recta, en vez de fusionar toda la imagen
    y despues ver que numero cae cerca. Asi el hueco de fusion se ata al ancho
    del numero y no puede engancharse a una recta lejana que solo comparte
    direccion. Entre varias candidatas gana la que corre por zona mas limpia."""
    dets = []
    for t in textos:
        mejor = None
        for p0, d in _semillas(segs, t, ang_tol, dist_frac * t["alto"]):
            ts = (t["centro"] - p0) @ d
            lo, hi = crecer_recta(segs, p0, d, ts, hueco_frac * t["ancho"])
            L = hi - lo
            if L < largo_min or abs((ts - lo) / L - 0.5) > centro_max:
                continue
            a, b, anclas = refinar_extremos(mask, segs, p0 + lo * d, p0 + hi * d)
            largo = np.hypot(*(b - a))
            if anclas < anclas_min or largo < largo_min:
                continue
            n = np.array([-d[1], d[0]])
            puntaje = abs((t["centro"] - p0) @ n) / t["alto"] \
                + peso_corredor * corredor_sucio(mask, a, b)
            if mejor is None or puntaje < mejor[0]:
                mejor = (puntaje, a, b, largo)
        if mejor is None:
            continue
        _, a, b, largo = mejor
        dets.append({"p1": a, "p2": b, "largo_px": float(largo), "texto": t["texto"],
                     "valor": t["valor"], "conf": t["conf"],
                     "unidad_por_px": float(t["valor"] / largo)})
    return dets


# ------------------------------------------------------------- 6. consenso
def escala_consenso(dets, k=3.0):
    """Mediana + filtro MAD, el mismo criterio que calcular_mejor_unidad_px del
    pipeline YOLO pero sin la dependencia de sklearn."""
    if not dets:
        return None, []
    e = np.array([d["unidad_por_px"] for d in dets])
    med = np.median(e)
    mad = (np.median(np.abs(e - med)) * 1.4826) or 1e-9
    for d, z in zip(dets, np.abs(e - med) / mad):
        d["aceptada"] = bool(z <= k)
    ok = [d for d in dets if d["aceptada"]]
    return float(np.median([d["unidad_por_px"] for d in ok])) if ok else float(med), ok


# -------------------------------------------------------------- orquestador
def procesar(img_path, motor=None):
    img = cv2.imread(img_path)
    if img is None:
        raise FileNotFoundError(img_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    segs = detectar_segmentos(gray)
    dets = detectar_cotas(segs, mask, textos_numericos(img, motor))
    escala, aceptadas = escala_consenso(dets)
    return {"imagen": img_path, "unidad_por_px": escala, "detecciones": dets,
            "aceptadas": aceptadas, "img": img}


def refinar_deteccion(img, p1, p2, radio=25.0):
    """Ajusta con LSD los extremos de una cota ya detectada (por ejemplo los
    keypoints de YOLO-pose de unidad_a_pixeles.py).

    Medido sobre el test set con extremos GT mas ruido gaussiano, el refinado
    conviene solo si el detector se equivoca mas de ~15 px por punta:
        sigma= 8 px -> |err largo|<3%: 68% sin refinar, 59% refinado (empeora)
        sigma=15 px -> 47% sin refinar, 50% refinado
        sigma=25 px -> 33% sin refinar, 43% refinado
    Medi el error real de tus keypoints antes de encadenarlo."""
    p1, p2 = np.asarray(p1, float), np.asarray(p2, float)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    segs = detectar_segmentos(gray)
    d = p2 - p1; L = np.hypot(*d)
    if L < 1:
        return p1, p2
    d = d / L
    lo, hi = crecer_recta(segs, p1, d, L / 2, radio * 2, off_tol=radio)
    q1, q2, _ = refinar_extremos(mask, segs, p1 + lo * d, p1 + hi * d)
    return (q1, q2) if np.hypot(*(q1 - p1)) < np.hypot(*(q1 - p2)) else (q2, q1)


def dibujar(rep, out_path, gt_json=None):
    """Verde: aceptada por el consenso. Rojo: descartada por MAD.
    Azul: cota anotada (solo si se pasa el labelme)."""
    img = rep["img"].copy()
    if gt_json and os.path.exists(gt_json):
        for sh in json.load(open(gt_json))["shapes"]:
            g1, g2 = (np.array(q, int) for q in sh["points"][:2])
            cv2.line(img, tuple(g1), tuple(g2), (255, 120, 0), 4)
    for d in rep["detecciones"]:
        col = (0, 170, 0) if d["aceptada"] else (0, 0, 255)
        p1, p2 = d["p1"].astype(int), d["p2"].astype(int)
        cv2.line(img, tuple(p1), tuple(p2), col, 2)
        cv2.putText(img, f"{d['texto']}|{d['unidad_por_px']:.4f}", tuple((p1 + p2) // 2),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, col, 1)
    cv2.imwrite(out_path, img)


# Figuras de REPORTE_LSD.md: (imagen, recorte de zoom o None, zoom). Estan fijas
# a proposito, son los ejemplos que el reporte comenta.
FIGURAS = [("2725", (0, 760, 1024, 920), 1.2),
           ("2706", (330, 300, 620, 660), 2.2),
           ("2701", (60, 800, 620, 900), 1.6),
           ("2706", None, None),
           ("2709", None, None)]


def figuras_del_reporte(dir_img, out_dir, motor=None):
    """Regenera las figuras que cita REPORTE_LSD.md, con los mismos recortes."""
    os.makedirs(out_dir, exist_ok=True)
    for ident, caja, f in FIGURAS:
        ip = os.path.join(dir_img, ident + ".jpg")
        jf = os.path.join(dir_img, ident + ".json")
        rep = procesar(ip, motor)
        if caja is None:
            dibujar(rep, os.path.join(out_dir, f"{ident}_lsd.jpg"), jf)
            print(f"{ident}_lsd.jpg  escala={rep['unidad_por_px']} "
                  f"aceptadas={len(rep['aceptadas'])}/{len(rep['detecciones'])}")
            continue
        entero = os.path.join(out_dir, f"_tmp_{ident}.jpg")
        dibujar(rep, entero, jf)
        img = cv2.imread(entero)
        os.remove(entero)
        x1, y1, x2, y2 = caja
        c = cv2.resize(img[y1:y2, x1:x2], None, fx=f, fy=f, interpolation=cv2.INTER_CUBIC)
        dentro = [d for d in rep["detecciones"]
                  if x1 < (d["p1"][0] + d["p2"][0]) / 2 < x2
                  and y1 < (d["p1"][1] + d["p2"][1]) / 2 < y2]
        c = cv2.copyMakeBorder(c, 0, 26 * max(1, len(dentro)), 0, 0,
                               cv2.BORDER_CONSTANT, value=(255, 255, 255))
        for i, d in enumerate(dentro, 1):
            cv2.putText(c, f"{d['texto']} -> {d['largo_px']:.0f} px -> "
                           f"{d['unidad_por_px']:.4f} u/px",
                        (8, int((y2 - y1) * f) + 20 * i), cv2.FONT_HERSHEY_SIMPLEX, 0.55,
                        (0, 150, 0) if d["aceptada"] else (0, 0, 220), 1)
        cv2.imwrite(os.path.join(out_dir, f"zoom_{ident}.jpg"), c)
        print(f"zoom_{ident}.jpg  " + "  ".join(
            f"{d['texto']}={d['largo_px']:.0f}px" for d in dentro))


# --------------------------------------------------------------- evaluacion
def _err_extremos(p, q, g1, g2):
    return min(np.hypot(*(p - g1)) + np.hypot(*(q - g2)),
               np.hypot(*(q - g1)) + np.hypot(*(p - g2)))


def evaluar(dirp, limite=None):
    """Contra las anotaciones labelme. Mide lo que aporta LSD:
      - recall / precision geometricos de las cotas
      - error de largo en pixeles sobre las cotas bien emparejadas, que es
        exactamente el error de escala que introduce la parte geometrica.

    OJO: Dimlinegenerator_v22.py:503 sortea un dimlfac por cota, asi que las
    cotas 'dim_*' de una misma imagen NO comparten escala y no hay escala GT
    por imagen contra la cual comparar la salida del consenso.
    """
    from rapidocr_onnxruntime import RapidOCR
    motor = RapidOCR()
    n_gt = n_ok = n_det = 0
    err_largo = []
    for jf in sorted(glob.glob(os.path.join(dirp, "*.json")))[:limite]:
        ip = jf[:-5] + ".jpg"
        if not os.path.exists(ip):
            continue
        rep = procesar(ip, motor)
        acc = rep["aceptadas"]
        n_det += len(acc)
        usadas = set()
        for sh in json.load(open(jf))["shapes"]:
            g1, g2 = np.array(sh["points"][0]), np.array(sh["points"][1])
            gl = np.hypot(*(g2 - g1))
            if gl < 40:
                continue
            n_gt += 1
            tol = max(30.0, 0.20 * gl)
            cerca = [(i, d) for i, d in enumerate(acc) if i not in usadas
                     and _err_extremos(d["p1"], d["p2"], g1, g2) <= tol]
            if cerca:
                i, d = min(cerca, key=lambda x: _err_extremos(x[1]["p1"], x[1]["p2"], g1, g2))
                usadas.add(i); n_ok += 1
                err_largo.append(100 * (d["largo_px"] - gl) / gl)
        print(f"{os.path.basename(ip)} escala={rep['unidad_por_px']} "
              f"aceptadas={len(acc)}/{len(rep['detecciones'])}")
    e = np.array(err_largo)
    print("\n--- resumen ---")
    print(f"cotas GT={n_gt}  recall={100 * n_ok / max(n_gt, 1):.1f}%  "
          f"precision={100 * n_ok / max(n_det, 1):.1f}%  (detecciones={n_det})")
    if len(e):
        print(f"error de largo en las emparejadas: mediana={np.median(e):+.2f}%  "
              f"MAD={np.median(np.abs(e - np.median(e))):.2f}  "
              f"|err|<5%={100 * np.mean(np.abs(e) < 5):.1f}%  n={len(e)}")


def _autotest():
    """Chequeo minimo de la geometria, sin imagenes ni OCR."""
    segs = np.array([[10, 50, 60, 50], [90, 50, 140, 50],      # cota partida al medio
                     [10, 30, 10, 70], [140, 30, 140, 70]],    # lineas de extension
                    np.float32)
    p0, d = np.array([10.0, 50.0]), np.array([1.0, 0.0])
    lo, hi = crecer_recta(segs, p0, d, 65.0, 40.0)
    assert (lo, hi) == (0.0, 130.0), (lo, hi)
    lo2, hi2 = crecer_recta(segs, p0, d, 65.0, 10.0)             # hueco chico: no une
    assert hi2 - lo2 < 60, (lo2, hi2)
    mask = np.zeros((200, 200), np.uint8)
    a, b, anclas = refinar_extremos(mask, segs, p0 + lo * d, p0 + hi * d)
    assert anclas == 2 and abs(np.hypot(*(b - a)) - 130) < 2, (a, b, anclas)
    assert corredor_sucio(mask, a, b) == 0.0                     # lienzo vacio
    t = {"centro": np.array([75.0, 44.0]), "ang": 0.0, "alto": 10.0, "ancho": 20.0,
         "texto": "13", "valor": 13.0, "conf": 0.9}
    det, = detectar_cotas(segs, mask, [t])
    assert abs(det["unidad_por_px"] - 0.1) < 0.005, det
    lejos = dict(t, centro=np.array([75.0, 120.0]))              # numero de otro renglon
    assert detectar_cotas(segs, mask, [lejos]) == []
    escala, ok = escala_consenso([{"unidad_por_px": v} for v in (0.10, 0.11, 0.09, 50.0)])
    assert abs(escala - 0.10) < 0.02 and len(ok) == 3, (escala, ok)
    print("autotest ok")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--img")
    ap.add_argument("--dir")
    ap.add_argument("--viz")
    ap.add_argument("--eval", action="store_true")
    ap.add_argument("--test", action="store_true")
    ap.add_argument("--limite", type=int)
    ap.add_argument("--reporte", help="directorio donde volcar las figuras con GT")
    a = ap.parse_args()
    if a.test:
        _autotest()
    elif a.reporte:
        figuras_del_reporte(a.dir or "dataset/test/images", a.reporte)
    elif a.eval:
        evaluar(a.dir or "dataset/test/images", a.limite)
    elif a.img:
        r = procesar(a.img)
        print(json.dumps({"unidad_por_px": r["unidad_por_px"],
                          "cotas": [{"texto": d["texto"], "valor": d["valor"],
                                     "largo_px": round(d["largo_px"], 1),
                                     "unidad_por_px": d["unidad_por_px"],
                                     "aceptada": d["aceptada"]}
                                    for d in r["detecciones"]]}, indent=2, ensure_ascii=False))
        if a.viz:
            dibujar(r, a.viz)
    else:
        ap.error("pasa --img, --dir --eval o --test")
