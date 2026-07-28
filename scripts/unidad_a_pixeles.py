#!/usr/bin/env python
# coding: utf-8

# Dependencias necesarias (instalar antes de correr este script):
#   pip install scikit-image
#   pip install ultralytics
#   pip install scikit-learn
#   pip install rapidocr_onnxruntime          # para correr en CPU
#   pip install rapidocr_onnxruntime[gpu]     # alternativa: para correr en GPU
#   pip install gdown                          # para descargar el modelo desde Google Drive
#
# Nota: este script importa download_model() y get_model_from_manifest()
# desde inference_engine.py, que debe estar en el mismo directorio (o en
# el PYTHONPATH) para que el import funcione.

import re
import math
import sys
import argparse
from pathlib import Path

import cv2
import numpy as np
from skimage.morphology import skeletonize
from ultralytics import YOLO
from rapidocr_onnxruntime import RapidOCR  # RapidOCR es un fork de PaddleOCR

import inference_engine
from inference_engine import download_model, get_model_from_manifest


# --- Configuración del modelo (manifest + descarga desde Google Drive) ---
# Model ID a usar por defecto; se resuelve contra models/models.json y se
# descarga (o se toma de caché local) reutilizando las funciones de
# inference_engine.py en lugar de un path hardcodeado a ./modelo/best.pt
MODEL_ID = "v1.2-yolo11mPose-DimDetector"

# Se ancla la ubicación de "models/" al archivo inference_engine.py (mismo
# criterio que usa su propio main(): base_dir = parent.parent), así el
# manifest/caché resuelto es siempre el mismo sin importar desde qué
# directorio se invoque este script.
_BASE_DIR = Path(inference_engine.__file__).resolve().parent.parent
MANIFEST_PATH = _BASE_DIR / "models" / "models.json"
CACHE_DIR = _BASE_DIR / "models" / "cache"


def cargar_modelo_yolo(model_id=MODEL_ID):
    """
    Resuelve el modelo en el manifest (models/models.json), lo descarga
    desde Google Drive si todavía no está en caché local -reutilizando
    download_model() y get_model_from_manifest() de inference_engine.py-
    y devuelve el modelo YOLO ya cargado y listo para usar.

    Parameters
    ----------
    model_id : str  ID del modelo tal como figura en models.json
                     (por defecto, MODEL_ID definido arriba)

    Returns
    -------
    YOLO : instancia del modelo cargado

    Raises
    ------
    FileNotFoundError : si el manifest no existe, el model_id no está
                         registrado en él, o la descarga no generó el
                         archivo esperado
    """
    model_meta = get_model_from_manifest(model_id, MANIFEST_PATH)
    if not model_meta:
        raise FileNotFoundError(
            f"Model ID '{model_id}' no encontrado en el manifest: {MANIFEST_PATH}"
        )

    ext = ".pt" if model_meta.get("model_type") == "ultralytics" else ".pth"
    local_model_path = CACHE_DIR / f"{model_meta['id']}_v{model_meta['version']}{ext}"

    download_model(model_meta["drive_id"], str(local_model_path))

    if not local_model_path.exists():
        raise FileNotFoundError(
            f"La descarga no generó el archivo esperado: {local_model_path}"
        )

    print(f"[+] Modelo '{model_id}' listo en: {local_model_path}", file=sys.stderr)
    return YOLO(str(local_model_path))


def limpiar_numeros_ocr(texto_ocr):
    # 1. Limpieza básica de espacios y basura textual del OCR
    texto = texto_ocr.strip()
    
    # Si no hay caracteres numéricos, salir temprano
    if not any(char.isdigit() for char in texto):
        return 0.0

    # -----------------------------------------------------------------
    # CASO NUEVO: Números pequeños con 3 decimales reales (Ej: 4.695 o 0.006)
    # Si contiene un solo punto y empieza con pocos dígitos antes del punto,
    # es un decimal, NO un indicador de miles.
    # -----------------------------------------------------------------
    if texto.count('.') == 1 and ',' not in texto:
        partes = texto.split('.')
        # Si a la izquierda hay entre 1 y 2 dígitos (ej: 4.695, 12.345), es decimal.
        if len(partes[0]) <= 2 and len(partes[1]) == 3:
            return _convertir_a_float(texto)

    # 2. CASO A: Formato Europeo/Argentino (1.250,45 o simplemente 15,45)
    if ',' in texto and ('.' not in texto or texto.find('.') < texto.find(',')):
        partes = texto.split(',')
        if len(partes) == 2 and len(partes[1]) != 3:
            texto = texto.replace('.', '')  # Elimina puntos de miles
            texto = texto.replace(',', '.')  # Convierte la coma decimal en punto
            return _convertir_a_float(texto)

    # 3. CASO B: Formato Americano / Genérico (1,250.45 o 1,500 o 15.45)
    if '.' in texto:
        partes = texto.split('.')
        if len(partes[-1]) != 3:
            texto = texto.replace(',', '')
            return _convertir_a_float(texto)
            
    # 4. CASO C: Números enteros con comas de miles (ej: "1,500" -> 1500.0)
    if re.search(r',\d{3}$', texto):
        texto = texto.replace(',', '')
        return _convertir_a_float(texto)
        
    # 5. CASO D: Números enteros con puntos de miles (ej: "1.500" -> 1500.0)
    # Solo se ejecutará si el número tiene más de 2 dígitos a la izquierda (ej: 145.600)
    if re.search(r'\.\d{3}$', texto):
        texto = texto.replace('.', '')
        return _convertir_a_float(texto)

    # Caída de emergencia
    texto = texto.replace(',', '.')
    return _convertir_a_float(texto)

def _convertir_a_float(string_limpio):
    try:
        return abs(float(string_limpio))
    except ValueError:
        return 0.0

def extraeRapidOCR(imagen):
 # Inicializas el motor de RapidOCR
 engine = RapidOCR()
 imagen_rgb = cv2.cvtColor(imagen, cv2.COLOR_BGR2RGB)
# Ejecutas la inferencia
# (text_score contiene la lista de cajas, textos y niveles de confianza)
 result, elapse = engine(imagen_rgb)
 textos=[]   
 if result:
    for line in result:
        coordenadas, texto, confianza = line
        #print(f"Texto detectado: {texto} | Confianza: {confianza}")
        textos.append({"texto": texto, "confianza": confianza})
 return textos       

_full_engine = None

def extraer_texto_por_keypoint(roi, x_c_rel, y_c_rel):
    """
    Estrategia alternativa: corre RapidOCR completo (detección + reconocimiento)
    sobre un ROI amplio, y de TODAS las cajas de texto que encuentra, se queda
    únicamente con la que contiene al keypoint del texto (p3). Así no importa
    si el ROI inicial es generoso ni si hay anotaciones vecinas dentro: cada
    caja detectada ya viene con su propio texto reconocido, y solo se usa la
    que efectivamente envuelve al punto objetivo.

    Parameters
    ----------
    roi      : imagen recortada (BGR) — puede ser una ventana amplia
    x_c_rel  : coordenada x de p3 relativa al ROI (no a la imagen original)
    y_c_rel  : coordenada y de p3 relativa al ROI (no a la imagen original)

    Returns
    -------
    dict {"texto": str, "confianza": float, "box": [[x,y],...]} de la caja
    que contiene el keypoint, o None si ninguna caja lo contiene.
    """
    global _full_engine
    if roi is None or roi.size == 0:
        return None

    try:
        if _full_engine is None:
            _full_engine = RapidOCR()

        imagen_rgb = cv2.cvtColor(roi, cv2.COLOR_BGR2RGB)
        result, _ = _full_engine(imagen_rgb)

        if not result:
            return None

        x_c_rel_f, y_c_rel_f = float(x_c_rel), float(y_c_rel)

        for box, texto, confianza in result:
            poligono = np.array(box, dtype=np.float32)
            # pointPolygonTest: >=0 significa dentro o sobre el borde.
            # measureDist=False es más rápido y alcanza para esta decisión.
            dentro = cv2.pointPolygonTest(poligono, (x_c_rel_f, y_c_rel_f), False) >= 0
            if dentro:
                return {"texto": texto, "confianza": confianza, "box": box}

        return None

    except Exception:
        return None

_det_engine = None

def ajustar_roi_a_texto(roi, offset_x, offset_y, margen_px=10):
    """
    Usa solo el detector de texto (sin reconocimiento) para encontrar el
    bbox real del texto dentro de un ROI ya recortado, y devuelve un ROI
    ajustado al ancho/alto real de los glifos, evitando capturar vecinos.

    Parameters
    ----------
    roi        : imagen recortada (BGR) sobre la que se busca el texto
    offset_x   : x1 del roi en coordenadas de la imagen original
    offset_y   : y1 del roi en coordenadas de la imagen original
    margen_px  : padding fijo en píxeles alrededor del bbox detectado

    Returns
    -------
    coords_abs : [x1, y1, x2, y2] en coordenadas absolutas, o None si el
                 detector no encontró texto (se debe conservar el ROI previo)
    """
    global _det_engine
    if roi is None or roi.size == 0:
        return None

    try:
        if _det_engine is None:
            _det_engine = RapidOCR()

        imagen_rgb = cv2.cvtColor(roi, cv2.COLOR_BGR2RGB)
        # use_rec=False -> solo corre el detector (DB), no el reconocedor.
        # Mucho más rápido y es justo lo que se necesita para el bbox.
        det_result, _ = _det_engine(imagen_rgb, use_det=True, use_cls=False, use_rec=False)

        if not det_result:
            return None

        xs, ys = [], []
        for box in det_result:
            pts = np.array(box)
            xs.extend(pts[:, 0].tolist())
            ys.extend(pts[:, 1].tolist())

        if not xs or not ys:
            return None

        x1 = offset_x + min(xs) - margen_px
        y1 = offset_y + min(ys) - margen_px
        x2 = offset_x + max(xs) + margen_px
        y2 = offset_y + max(ys) + margen_px

        return [int(x1), int(y1), int(x2), int(y2)]

    except Exception:
        # Si el detector falla por cualquier motivo, no rompemos el flujo:
        # se conserva el ROI previo (geométrico/bbox) tal cual.
        return None


def _es_franja_fondo(franja, umbral_blanco=235, frac_fondo=0.92):
    """
    Determina si una franja de píxeles (fila o columna) es mayormente fondo
    (papel blanco / color uniforme), es decir que NO contiene texto.

    Parameters
    ----------
    franja        : array 2D (gris) correspondiente a la fila/columna a evaluar
    umbral_blanco : valor de gris a partir del cual se considera "fondo claro"
    frac_fondo    : fracción mínima de píxeles "fondo" para considerar la
                    franja vacía de contenido

    Returns
    -------
    bool : True si la franja es predominantemente fondo (sin texto)
    """
    if franja.size == 0:
        return True

    # Fondo = casi blanco O prácticamente uniforme (poca variación, sin trazos)
    frac_clara = float(np.mean(franja >= umbral_blanco))
    variacion = float(np.std(franja))

    return frac_clara >= frac_fondo or variacion < 4.0


def expandir_roi_hasta_fondo(img_gris, x1, y1, x2, y2, paso_px=4, max_pasos=15):
    """
    Expande una ROI inicial (ajustada al texto) de a pequeños pasos en las
    cuatro direcciones, deteniéndose en cada dirección en cuanto la franja
    nueva que se añadiría es mayormente fondo (papel blanco / sin trazos).

    Esto evita que un padding fijo "se coma" anotaciones vecinas: cada lado
    crece solo mientras siga habiendo contenido (texto/líneas) inmediatamente
    afuera del borde actual.

    Parameters
    ----------
    img_gris  : imagen completa en escala de grises (para muestrear franjas)
    x1,y1,x2,y2 : ROI inicial (coordenadas absolutas, ya recortada al texto)
    paso_px   : tamaño de cada paso de expansión, en píxeles
    max_pasos : tope de pasos por lado (limita el crecimiento máximo total)

    Returns
    -------
    [x1, y1, x2, y2] : ROI expandida, sin tocar zonas de fondo
    """
    h_img, w_img = img_gris.shape[:2]
    x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)

    activo = {"izq": True, "der": True, "arr": True, "abj": True}

    for _ in range(max_pasos):
        if activo["izq"]:
            nx1 = max(0, x1 - paso_px)
            if nx1 == x1 or _es_franja_fondo(img_gris[y1:y2, nx1:x1]):
                activo["izq"] = False
            else:
                x1 = nx1

        if activo["der"]:
            nx2 = min(w_img, x2 + paso_px)
            if nx2 == x2 or _es_franja_fondo(img_gris[y1:y2, x2:nx2]):
                activo["der"] = False
            else:
                x2 = nx2

        if activo["arr"]:
            ny1 = max(0, y1 - paso_px)
            if ny1 == y1 or _es_franja_fondo(img_gris[ny1:y1, x1:x2]):
                activo["arr"] = False
            else:
                y1 = ny1

        if activo["abj"]:
            ny2 = min(h_img, y2 + paso_px)
            if ny2 == y2 or _es_franja_fondo(img_gris[y2:ny2, x1:x2]):
                activo["abj"] = False
            else:
                y2 = ny2

        if not any(activo.values()):
            break

    return [x1, y1, x2, y2]

def optimizar_imagen_en_memoria_opencv(imagen_cv2,esq= False):
    """
    Recibe un objeto de imagen en OpenCV.
    Limpia imperfecciones (pelos/ruido) mediante suavizado morfológico,
    obtiene el esqueleto limpio y luego lo engrosa de forma uniforme.
    """
    # 1. Convertir a escala de grises
    if len(imagen_cv2.shape) == 3:
        img_gris = cv2.cvtColor(imagen_cv2, cv2.COLOR_BGR2GRAY)
    else:
        img_gris = imagen_cv2

    # 2. Escalar (Cúbica)
    img_escalada = cv2.resize(img_gris, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)

    # 3. Filtro de Enfoque (Unsharp Mask)
    blur_inicial = cv2.GaussianBlur(img_escalada, (3, 3), 0)
    img_enfocada = cv2.addWeighted(img_escalada, 2.0, blur_inicial, -1.0, 0)

    # 4. Binarización Adaptativa
    img_binaria = cv2.adaptiveThreshold(
        img_enfocada, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 45, 3
    )

    if esq:
        # =========================================================================
        # ELIMINACIÓN DE "PELOS" (PRE-ESQUELETIZACIÓN)
        # =========================================================================
        # Invertimos para trabajar (Texto blanco [255], Fondo negro [0])
        img_invertida = cv2.bitwise_not(img_binaria)

        # Paso A: Aplicamos un desenfoque sutil exclusivo a la máscara binaria 
        # para derretir los píxeles rugosos individuales de los bordes.
        img_suave = cv2.GaussianBlur(img_invertida, (3, 3), 0)
        _, img_suave_bin = cv2.threshold(img_suave, 127, 255, cv2.THRESH_BINARY)

        # Paso B: Apertura Morfológica (Morfología de apertura)
        # El uso de un kernel elíptico ayuda a "afeitar" las puntas y pelos aislados.
        kernel_limpieza = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        img_limpia = cv2.morphologyEx(img_suave_bin, cv2.MORPH_OPEN, kernel_limpieza)

        # =========================================================================
        # ESQUELETIZACIÓN LIMPIA
        # =========================================================================
        img_bool = img_limpia > 0
        esqueleto_bool = skeletonize(img_bool)
        img_esqueleto = (esqueleto_bool * 255).astype(np.uint8)

        # =========================================================================
        # ENGROSAR EL TRAZO UNIFORMEMENTE
        # =========================================================================
        # Usamos un kernel elíptico para que al engrosar los números mantengan
        # sus formas redondeadas naturales (ideal para el OCR)
        kernel_engrosar = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (4, 4))
        img_blanca_engrosada = cv2.dilate(img_esqueleto, kernel_engrosar, iterations=1)

        # Invertimos de vuelta a formato estándar (Texto Negro, Fondo Blanco)
        img_final = cv2.bitwise_not(img_blanca_engrosada)
    else: img_final= img_binaria

    return img_final

def _buffer_roi(coords, img_shape, factor=0.20):
    """
    Agrega un margen extra alrededor de una ROI, proporcional a su propio
    tamaño. Por ejemplo factor=0.20 agrega un 20% del ancho a cada lado
    (izquierda y derecha) y un 20% del alto arriba y abajo.

    Esto se usa para darle un poco de "aire" al texto detectado, porque un
    recorte demasiado ajustado a veces corta partes de las letras y eso
    empeora el OCR.

    Parameters
    ----------
    coords    : [x1, y1, x2, y2] ROI original, en coordenadas absolutas
    img_shape : shape (h, w, ...) de la imagen completa, para no salirnos
    factor    : cuánto margen agregar, como fracción del ancho/alto del ROI

    Returns
    -------
    [x1, y1, x2, y2] : ROI con margen agregado, recortada a los bordes de la imagen
    """
    h_img, w_img = img_shape[:2]
    x1, y1, x2, y2 = coords

    ancho = x2 - x1
    alto = y2 - y1
    margen_x = int(ancho * factor)
    margen_y = int(alto * factor)

    x1 = max(0, x1 - margen_x)
    y1 = max(0, y1 - margen_y)
    x2 = min(w_img, x2 + margen_x)
    y2 = min(h_img, y2 + margen_y)

    return [x1, y1, x2, y2]


def _rotar_punto_90_a_original(x, y, w_rot, h_rot, sentido="cw"):
    """
    Convierte un punto detectado en la imagen ROTADA 90° de vuelta a
    coordenadas de la imagen ORIGINAL (sin rotar).

    w_rot, h_rot : ancho y alto de la imagen YA rotada (la que se le pasó al modelo)
    sentido      : "cw"  -> la rotación aplicada fue cv2.ROTATE_90_CLOCKWISE
                   "ccw" -> la rotación aplicada fue cv2.ROTATE_90_COUNTERCLOCKWISE
    """
    if sentido == "cw":
        # Inversa de: x' = h_orig-1-y ; y' = x   (con h_orig == w_rot)
        x_orig = y
        y_orig = w_rot - 1 - x
    else:
        # Inversa de: x' = y ; y' = w_orig-1-x   (con w_orig == h_rot)
        x_orig = h_rot - 1 - y
        y_orig = x
    return x_orig, y_orig


def _detectar_en_imagen(model, img_array, img_original, origen_rotacion=None,conf=0.3):
    """
    Corre la inferencia YOLO + el pipeline de OCR sobre una imagen ya cargada
    en memoria (img_array), y arma la lista de detecciones. Es la misma
    lógica que antes vivía directamente dentro de procesaImagen, ahora
    extraída para poder reutilizarla tanto con la imagen original como con
    una copia rotada 90°.

    Parameters
    ----------
    model              : modelo YOLO ya cargado
    img_array          : imagen (BGR, numpy array) sobre la que se infiere.
                          Puede ser la original o una rotada 90°.
    origen_rotacion    : None si img_array es la imagen original sin rotar,
                          o "cw"/"ccw" si img_array fue rotada en ese sentido
                          respecto de la original. Se usa para reproyectar
                          coordenadas y para etiquetar el origen de cada
                          detección en el reporte.
    img_original       : imagen (BGR, numpy array) ORIGINAL sin rotar. Se usa
                          siempre para el recorte/OCR final, sin importar si
                          img_array es la original o una rotada.

    Returns
    -------
    list[dict] : detecciones en coordenadas de la imagen ORIGINAL (siempre),
                  con un campo adicional "origen_rotacion" para trazabilidad.
    """
    results = model.predict(imgsz=1024, source=img_array, conf=conf)

    h_rot, w_rot = img_array.shape[:2]

    reporte_detecciones = []

    ind = 0
    for r in results:
        boxes = r.boxes

        for idx, k in enumerate(r.keypoints):
            kp = k.xy[0].cpu().numpy()
            precision = boxes[ind].conf[0].item()
            distancia_px = 0.0
            dimension_real = 0.0
            texto_ocr = ""
            relacion_px_metro = 0.0

            ind = ind + 1

            distancia = 0
            dimension = 0
            roi_coords = None
            estrategia_roi = None

            # Si esta detección viene de la imagen rotada, reproyectar cada
            # keypoint a coordenadas de la imagen original ANTES de seguir,
            # para que el resto del pipeline (que recorta sobre img_original)
            # funcione exactamente igual sin importar el origen.
            if origen_rotacion is not None:
                kp_reproyectado = []
                for punto in kp:
                    if punto[0] == 0 and punto[1] == 0:
                        kp_reproyectado.append([0.0, 0.0])
                    else:
                        nx, ny = _rotar_punto_90_a_original(
                            punto[0], punto[1], w_rot, h_rot, sentido=origen_rotacion
                        )
                        kp_reproyectado.append([nx, ny])
                kp = np.array(kp_reproyectado, dtype=np.float32)

            kp_list = kp.tolist()

            if len(kp) >= 2:
                p1 = kp[0]
                p2 = kp[1]

                if p1[0] != 0 and p2[0] != 0:
                    distancia = math.sqrt((p2[0] - p1[0])**2 + (p2[1] - p1[1])**2)
                else:
                    print("Uno de los dos primeros puntos no fue detectado.")

            # --- 2. OCR ALREDEDOR DEL TERCER PUNTO (siempre sobre img_original) ---
            if len(kp) >= 3:
                p3 = kp[2]

                if p3[0] != 0 and p3[1] != 0:
                    x_c, y_c = int(p3[0]), int(p3[1])

                    margen_x = 70
                    margen_y = 70

                    h_img, w_img = img_original.shape[:2]
                    x1_crop = max(0, x_c - margen_x)
                    y1_crop = max(0, y_c - margen_y)
                    x2_crop = min(w_img, x_c + margen_x)
                    y2_crop = min(h_img, y_c + margen_y)

                    roi_amplio = img_original[y1_crop:y2_crop, x1_crop:x2_crop]
                    estrategia_roi = "hardcoded_70x70"

                    resultado_kp = None
                    
                    
                    # ── ESTRATEGIA — correr RapidOCR completo
                    # (detección + reconocimiento) sobre la ventana amplia, y
                    # quedarse SOLO con la caja que contiene al keypoint p3.
                    # Esa caja ya trae su propio texto reconocido: no hace
                    # falta ajustar manualmente el tamaño del ROI. ──

                    if roi_amplio.size > 0:
                        x_c_rel = x_c - x1_crop
                        y_c_rel = y_c - y1_crop
                        resultado_kp = extraer_texto_por_keypoint(roi_amplio, x_c_rel, y_c_rel)

                    if resultado_kp is not None:
                        # Convertir la caja encontrada (relativa al ROI amplio)
                        # a coordenadas absolutas de la imagen original.
                        caja = np.array(resultado_kp["box"], dtype=np.float32)
                        bx1 = x1_crop + caja[:, 0].min()
                        by1 = y1_crop + caja[:, 1].min()
                        bx2 = x1_crop + caja[:, 0].max()
                        by2 = y1_crop + caja[:, 1].max()

                        # Hacemos el ROI simétrico alrededor del keypoint p3:
                        # tomamos la mayor distancia entre p3 y cada borde de
                        # la caja detectada, y usamos esa misma distancia para
                        # los dos lados (izq/der y arriba/abajo). Así el punto
                        # queda siempre centrado en el recorte final.
                        dx = max(x_c - bx1, bx2 - x_c)
                        dy = max(y_c - by1, by2 - y_c)
                        x1_crop = max(0, int(x_c - dx))
                        x2_crop = min(w_img, int(x_c + dx))
                        y1_crop = max(0, int(y_c - dy))
                        y2_crop = min(h_img, int(y_c + dy))

                        # Pequeño margen extra para no cortar las letras al ras
                        x1_crop, y1_crop, x2_crop, y2_crop = _buffer_roi(
                            [x1_crop, y1_crop, x2_crop, y2_crop], img_original.shape, factor=0.20
                        )
                        estrategia_roi = "rapidocr_box_keypoint_sym"

                        texto_ocr = [{"texto": resultado_kp["texto"],
                                      "confianza": resultado_kp["confianza"]}]
                        roi_coords = [x1_crop, y1_crop, x2_crop, y2_crop]

                        if len(texto_ocr) > 0:
                            dimension = limpiar_numeros_ocr(texto_ocr[0]["texto"])

                    else:
                        roi_ajustado = ajustar_roi_a_texto(roi_amplio, x1_crop, y1_crop)
                        if roi_ajustado is not None:
                            ax1, ay1, ax2, ay2 = roi_ajustado
                            ax1 = max(0, ax1)
                            ay1 = max(0, ay1)
                            ax2 = min(w_img, ax2)
                            ay2 = min(h_img, ay2)
                            if ax2 > ax1 and ay2 > ay1:
                                x1_crop, y1_crop, x2_crop, y2_crop = ax1, ay1, ax2, ay2
                                estrategia_roi = "fallback_detector_ajustado"

                        img_gris_full = cv2.cvtColor(img_original, cv2.COLOR_BGR2GRAY) \
                            if len(img_original.shape) == 3 else img_original
                        x1_crop, y1_crop, x2_crop, y2_crop = expandir_roi_hasta_fondo(
                            img_gris_full, x1_crop, y1_crop, x2_crop, y2_crop
                        )
                        estrategia_roi = estrategia_roi + "+expandido_hasta_fondo"

                        roi_coords = [int(x1_crop), int(y1_crop), int(x2_crop), int(y2_crop)]
                        roi = img_original[y1_crop:y2_crop, x1_crop:x2_crop]

                        if roi.size > 0:
                            texto_ocr = extraeRapidOCR(roi)
                            if len(texto_ocr) > 0:
                                dimension = limpiar_numeros_ocr(texto_ocr[0]['texto'])
                        else:
                            print("La región de recorte está vacía.")
                else:
                    print("El tercer punto no fue detectado.")

            deteccion_data = {
                "nro_deteccion": idx + 1,
                "precision_bbox": round(precision, 4),
                "texto_detectado": texto_ocr,
                "keypoints": kp_list,
                "roi_coords": roi_coords,
                "estrategia_roi": estrategia_roi,
                "dimension_real": dimension,
                "distancia_px": round(distancia, 2),
                "unidad_por_px": round(dimension/distancia, 10) if dimension != 0 else 0,
                "origen_rotacion": origen_rotacion if origen_rotacion is not None else "0deg",
            }

            reporte_detecciones.append(deteccion_data)

    return reporte_detecciones


def procesaImagen(img_path, incluir_rotacion_90=False, sentido_rotacion="cw",conf= 0.3, model_id=MODEL_ID,):
    """
    Procesa una imagen con el modelo YOLO de keypoints + OCR.

    Parameters
    ----------
    img_path             : ruta de la imagen a procesar
    incluir_rotacion_90  : si True, además de la pasada normal sobre la
                            imagen original, corre una segunda inferencia
                            sobre la misma imagen rotada 90°. Esto ayuda a
                            recuperar detecciones de cotas que el modelo
                            YOLO de keypoints no encuentra bien cuando el
                            texto está orientado verticalmente (la detección
                            de keypoints es sensible a la orientación).
                            Las coordenadas de esa segunda pasada se
                            reproyectan de vuelta al sistema de la imagen
                            original, así que el reporte resultante queda
                            siempre en el mismo sistema de coordenadas.
    sentido_rotacion      : "cw" o "ccw", sentido de la rotación de 90° a
                            probar. Por defecto horario.
    model_id              : ID del modelo en models.json. Se descarga
                            automáticamente desde Google Drive (o se toma
                            de caché) vía cargar_modelo_yolo(). Por defecto,
                            MODEL_ID definido al inicio del archivo.

    Returns
    -------
    list[dict] : reporte combinado de detecciones (0° + 90° opcional)
    """
    # Cargar el modelo entrenado (se resuelve contra el manifest y se
    # descarga/cachea automáticamente si todavía no está en disco)
    model = cargar_modelo_yolo(model_id)

    # Cargar la imagen con OpenCV para poder recortar la zona del OCR.
    # Siempre se usa esta imagen (sin rotar) para el recorte/OCR final,
    # sin importar si la detección de keypoints vino de la pasada
    # rotada o no.
    img_original = cv2.imread(img_path)

    # ── Pasada 1: imagen original (0°) ──
    reporte_total = _detectar_en_imagen(model, img_original, img_original, origen_rotacion=None,conf= conf,)

    # ── Pasada 2 (opcional): imagen rotada 90° ──
    if incluir_rotacion_90:
        if sentido_rotacion == "cw":
            img_rotada = cv2.rotate(img_original, cv2.ROTATE_90_CLOCKWISE)
        else:
            img_rotada = cv2.rotate(img_original, cv2.ROTATE_90_COUNTERCLOCKWISE)

        reporte_rotado = _detectar_en_imagen(
            model, img_rotada, img_original, origen_rotacion=sentido_rotacion
        )

        # Renumerar para que no se pisen los "nro_deteccion" entre ambas pasadas
        offset = len(reporte_total)
        for i, det in enumerate(reporte_rotado):
            det["nro_deteccion"] = offset + i + 1

        reporte_total.extend(reporte_rotado)

    return reporte_total

def es_pendiente_similar(detec_a, detec_b, tolerancia=0.07):
    """
    Compara dos detecciones y dice si "podrían" tener la misma escala real.

    La idea es simple: si las dos detecciones miden la MISMA escala del
    plano, entonces sus pendientes (ocr / dist) deberían ser casi iguales.
    Si son muy distintas, probablemente una de las dos está mal (keypoint
    mal puesto, o el OCR leyó mal el número).

    Parameters
    ----------
    detec_a, detec_b : dict   dos detecciones con "unidad_por_px"
    tolerancia        : float diferencia relativa máxima permitida
                         (0.07 = 7% de diferencia)

    Returns
    -------
    bool : True si las dos pendientes son "parecidas"
    """
    pendiente_a = detec_a["unidad_por_px"]
    pendiente_b = detec_b["unidad_por_px"]

    if pendiente_a <= 0 or pendiente_b <= 0:
        return False

    diferencia = abs(pendiente_a - pendiente_b)
    promedio = (pendiente_a + pendiente_b) / 2
    diferencia_relativa = diferencia / promedio

    return diferencia_relativa <= tolerancia


def agrupar_por_pendiente_similar(detecciones, tolerancia=0.07):
    """
    Junta las detecciones en grupos: todas las que tienen una pendiente
    parecida quedan en el mismo grupo. Esto reemplaza a DBSCAN con un
    agrupamiento simple, fácil de entender y de depurar.

    Cómo funciona (en palabras simples)
    ------------------------------------
    Recorremos las detecciones una por una. Para cada una, buscamos si ya
    existe un grupo cuya pendiente "promedio" se parezca a la de esta
    detección. Si existe, la sumamos a ese grupo. Si no existe ningún
    grupo parecido, creamos un grupo nuevo solo con esta detección.

    Parameters
    ----------
    detecciones : list[dict]   detecciones ya filtradas por confianza,
                                cada una con "unidad_por_px" > 0
    tolerancia  : float        qué tan parecidas deben ser dos pendientes
                                para considerarse del mismo grupo

    Returns
    -------
    list[list[dict]] : lista de grupos; cada grupo es una lista de
                        detecciones con pendiente similar entre sí
    """
    grupos = []

    for detec in detecciones:
        grupo_encontrado = None

        for grupo in grupos:
            # Comparamos contra el primer punto del grupo como referencia
            if es_pendiente_similar(detec, grupo[0], tolerancia):
                grupo_encontrado = grupo
                break

        if grupo_encontrado is not None:
            grupo_encontrado.append(detec)
        else:
            grupos.append([detec])

    return grupos


def test_coherencia_lineal(grupo, tolerancia=0.15):
    """
    Comprueba que los puntos de un grupo formen una línea recta que pasa
    por el origen: dimension_real = pendiente × distancia_px.

    Si graficáramos OCR (eje Y) contra DIST (eje X), todos los puntos
    buenos deberían caer sobre la misma recta. Un punto que se aleja
    mucho de esa recta probablemente tiene un keypoint mal puesto o un
    OCR mal leído.

    Parameters
    ----------
    grupo      : list[dict]   detecciones del mismo grupo
    tolerancia : float        error relativo máximo permitido (0.15 = 15%)

    Returns
    -------
    list[dict] : solo las detecciones del grupo que sí siguen la recta
    """
    if len(grupo) < 2:
        # Con un solo punto no hay recta que comprobar: lo dejamos pasar
        # tal cual, ya quedará marcado como "candidato débil" más adelante.
        return grupo

    # Pendiente de referencia = mediana de las pendientes del grupo
    pendientes = [d["unidad_por_px"] for d in grupo]
    pendiente_referencia = float(np.median(pendientes))

    buenos = []
    for d in grupo:
        prediccion = pendiente_referencia * d["distancia_px"]
        real = d["dimension_real"]
        if real == 0:
            continue
        error_relativo = abs(prediccion - real) / real
        if error_relativo <= tolerancia:
            buenos.append(d)

    return buenos if buenos else grupo


def contar_cross_validaciones(detec_i, todas_las_detecciones, tolerancia=0.10):
    """
    Cuenta a cuántas OTRAS detecciones "valida" esta detección.

    La idea: si la pendiente (escala) de detec_i es correcta, entonces al
    multiplicarla por la distancia de OTRA detección (detec_j), el
    resultado debería parecerse al valor OCR real de esa otra detección.

        prediccion_j = escala_i * distancia_j
        ¿prediccion_j ≈ ocr_j ?

    Mientras más detecciones "j" valide correctamente, más confiable es
    la escala de detec_i.

    Parameters
    ----------
    detec_i                : dict        la detección que queremos evaluar
    todas_las_detecciones  : list[dict]  todas las detecciones disponibles
                                          (de cualquier grupo)
    tolerancia              : float       error relativo máximo permitido

    Returns
    -------
    int : cantidad de detecciones distintas que detec_i logra validar
    """
    escala_i = detec_i["unidad_por_px"]
    if escala_i <= 0:
        return 0

    validaciones = 0
    for detec_j in todas_las_detecciones:
        if detec_j is detec_i:
            continue
        if detec_j["dimension_real"] <= 0:
            continue

        prediccion_j = escala_i * detec_j["distancia_px"]
        real_j = detec_j["dimension_real"]
        error_relativo = abs(prediccion_j - real_j) / real_j

        if error_relativo <= tolerancia:
            validaciones += 1

    return validaciones


def elegir_mejor_grupo(grupos, todas_las_detecciones,
                        tol_lineal=0.15, tol_cruzado=0.10,
                        min_puntos_para_competir=2):
    """
    De todos los grupos de pendiente parecida, elige el más confiable.

    Por qué esta versión es distinta de la anterior
    --------------------------------------------------
    Antes el puntaje mezclaba "cantidad de puntos en el grupo" y
    "cross-validations" en una sola fórmula (tamaño*100 + cross-val).
    El problema es que ambas cosas miden, en el fondo, lo mismo: cuántos
    puntos apoyan a esta pendiente. Un grupo grande casi siempre gana
    también en cross-validation, porque sus propios miembros se validan
    entre sí. Sumarlas no agregaba información nueva, solo repetía la
    misma señal con otro nombre.

    Ahora separamos las dos preguntas:
      1. ¿Es este grupo un candidato serio? (filtro de tamaño mínimo)
      2. Entre los candidatos serios, ¿cuál predice mejor TODOS los
         datos disponibles, no solo los suyos? (cross-validation, y
         nada más, decide el ranking)

    Esto deja que la cross-validation aporte algo que el tamaño del
    grupo no puede ver: un grupo chico cuya pendiente igual predice
    bien puntos que quedaron en OTROS grupos (es decir, esos puntos
    eran en realidad la misma escala real, solo que la tolerancia de
    agrupado los separó). Ese caso ahora sí puede ganar.

    Reglas para decidir el ganador
    --------------------------------
    1. Si hay un solo grupo, ese gana directo (no hay con qué comparar).
    2. Se separan los grupos "grandes" (>= min_puntos_para_competir) de
       los "chicos" (1 punto, o muy pocos). Los grupos grandes son
       candidatos serios por sí solos.
    3. Si hay al menos un grupo grande, el ganador es el de MAYOR
       cross-validation total entre los grupos grandes (el tamaño ya
       hizo su trabajo en el paso 2, filtrando el ruido; ahora el
       desempate es 100% cross-validation).
    4. Si NINGÚN grupo llega al mínimo de puntos (por ejemplo, todas las
       detecciones quedaron solas, sin pareja), entonces comparamos
       todos los grupos chicos entre sí, también por cross-validation.

    Parameters
    ----------
    grupos                    : list[list[dict]]  grupos ya filtrados por
                                                    coherencia lineal
    todas_las_detecciones     : list[dict]         todas las detecciones
                                                    válidas (de todos los
                                                    grupos), para poder
                                                    hacer cross-validation
    tol_lineal                 : float    (no se usa acá, ya se aplicó antes)
    tol_cruzado                : float    tolerancia para contar una
                                            cross-validation como "acierto"
    min_puntos_para_competir   : int      cuántos puntos necesita un grupo
                                            para considerarse "serio" y no
                                            depender solo de cross-validation

    Returns
    -------
    list[dict] : el grupo ganador
    """
    grupos_no_vacios = [g for g in grupos if len(g) > 0]

    if not grupos_no_vacios:
        return []

    if len(grupos_no_vacios) == 1:
        return grupos_no_vacios[0]

    def cross_validacion_total(grupo):
        total = 0
        for detec in grupo:
            total += contar_cross_validaciones(
                detec, todas_las_detecciones, tolerancia=tol_cruzado
            )
        return total

    grupos_grandes = [g for g in grupos_no_vacios if len(g) >= min_puntos_para_competir]
    grupos_chicos = [g for g in grupos_no_vacios if len(g) < min_puntos_para_competir]

    candidatos = grupos_grandes if grupos_grandes else grupos_chicos

    mejor_grupo = max(candidatos, key=cross_validacion_total)
    return mejor_grupo


def filtro_mad(detecciones, k=3.0):
    """
    Quita valores raros (outliers) dentro de un grupo ya elegido, usando
    la Desviación Absoluta Mediana (MAD). Es un paso de limpieza extra,
    opcional, que se aplica DESPUÉS de elegir el mejor grupo.

    Parameters
    ----------
    detecciones : list[dict]  detecciones del grupo ganador
    k           : float       qué tan estricto es el filtro (más alto =
                               más permisivo)

    Returns
    -------
    list[dict] : detecciones que pasaron el filtro MAD
    """
    if len(detecciones) <= 1:
        # Con 0 o 1 punto no tiene sentido calcular MAD
        return detecciones

    escalas = np.array([d["unidad_por_px"] for d in detecciones])

    mediana = np.median(escalas)
    dev_absoluta = np.abs(escalas - mediana)
    mad = np.median(dev_absoluta)

    if mad == 0:
        mad = 1e-9

    mad_g = mad * 1.4826
    mad_z_scores = dev_absoluta / mad_g

    detecciones_finales = [d for d, z in zip(detecciones, mad_z_scores) if z <= k]

    return detecciones_finales if detecciones_finales else detecciones


def calcular_media_ponderada(detecciones):
    """
    Calcula el promedio ponderado final de "unidad_por_px".

    Cada detección "vota" con un peso = confianza_del_modelo × distancia_px.
    Las detecciones más confiables y con líneas más largas (más precisas)
    pesan más en el resultado final.

    Parameters
    ----------
    detecciones : list[dict]

    Returns
    -------
    float o None
    """
    suma_ponderada = 0.0
    suma_pesos = 0.0

    for d in detecciones:
        peso = d["precision_bbox"] * d["distancia_px"]
        suma_ponderada += peso * d["unidad_por_px"]
        suma_pesos += peso

    if suma_pesos == 0:
        return None

    return suma_ponderada / suma_pesos


def calcular_mejor_unidad_px(detecciones, tau=0.3, k=3.0,
                              tol_lineal=0.15, tol_cruzado=0.10,
                              tol_grupo=0.07, min_puntos_para_competir=2):
    """
    Calcula la mejor estimación de unidad_por_px usando este pipeline:

        1. Filtro de Confianza      -> se descartan detecciones de baja confianza
        2. Agrupar por pendiente    -> juntar detecciones que "podrían" ser
                                        la misma escala (reemplaza a DBSCAN)
        3. Test de coherencia lineal -> dentro de cada grupo, sacar los
                                         puntos que no siguen la recta
                                         dimension_real = pendiente * dist
        4. Elegir el mejor grupo    -> primero se descartan los grupos
                                        demasiado chicos para ser tomados
                                        en serio; entre los que quedan,
                                        gana el que mejor predice TODAS
                                        las detecciones disponibles
                                        (cross-validation)
        5. Filtro MAD (opcional)    -> limpieza extra dentro del grupo ganador
        6. Media Ponderada           -> promedio final, pesado por
                                        confianza × distancia

    Parameters
    ----------
    detecciones : list[dict]  salida de procesaImagen()
    tau          : float       confianza mínima para considerar una detección
    k            : float       qué tan estricto es el filtro MAD
    tol_lineal   : float       tolerancia del test de coherencia lineal (paso 3)
    tol_cruzado  : float       tolerancia de la cross-validation (paso 4)
    tol_grupo    : float       qué tan parecidas deben ser dos pendientes
                                para agruparse juntas (paso 2)

    Returns
    -------
    float o None : la mejor estimación de unidad_por_px
    """
    # ---------------------------------------------------------
    # PASO 1: Filtro de Confianza
    # ---------------------------------------------------------
    detecciones_filtradas = [d for d in detecciones if d["precision_bbox"] >= tau]

    if not detecciones_filtradas:
        print("Error: Ninguna detección pasó el filtro de confianza mínimo.")
        return None

    detecciones_validas = [d for d in detecciones_filtradas if d["unidad_por_px"] > 0]

    if not detecciones_validas:
        print("Error: No hay detecciones con unidad_por_px válida.")
        return None

    # ---------------------------------------------------------
    # PASO 2: Agrupar detecciones con pendiente parecida
    # ---------------------------------------------------------
    grupos = agrupar_por_pendiente_similar(detecciones_validas, tolerancia=tol_grupo)
    print(f"Se formaron {len(grupos)} grupo(s) de pendiente similar.")
    for i, grupo in enumerate(grupos):
        pendientes_grupo = [round(d["unidad_por_px"], 6) for d in grupo]
        print(f"  Grupo {i}: {len(grupo)} punto(s) -> pendientes {pendientes_grupo}")

    # ---------------------------------------------------------
    # PASO 3: Test de coherencia lineal dentro de cada grupo
    # ---------------------------------------------------------
    grupos_limpios = [test_coherencia_lineal(g, tolerancia=tol_lineal) for g in grupos]
    grupos_limpios = [g for g in grupos_limpios if len(g) > 0]

    if not grupos_limpios:
        print("Error: ningún grupo sobrevivió al test de coherencia lineal.")
        return None

    # ---------------------------------------------------------
    # PASO 4: Elegir el mejor grupo (filtro de tamaño + ranking por cross-validation)
    # ---------------------------------------------------------
    mejor_grupo = elegir_mejor_grupo(
        grupos_limpios, detecciones_validas,
        tol_lineal=tol_lineal, tol_cruzado=tol_cruzado,
        min_puntos_para_competir=min_puntos_para_competir,
    )

    if not mejor_grupo:
        print("Error: no se pudo elegir un grupo ganador.")
        return None

    print(f"Grupo ganador: {len(mejor_grupo)} punto(s), "
          f"pendientes {[round(d['unidad_por_px'], 6) for d in mejor_grupo]}")

    # ---------------------------------------------------------
    # PASO 5: Filtro MAD dentro del grupo ganador (limpieza extra)
    # ---------------------------------------------------------
    detecciones_finales = filtro_mad(mejor_grupo, k=k)

    if not detecciones_finales:
        print("Error: el filtro MAD descartó todas las detecciones del grupo ganador.")
        return None

    # ---------------------------------------------------------
    # PASO 6: Media Ponderada
    # ---------------------------------------------------------
    mejor_estimacion = calcular_media_ponderada(detecciones_finales)

    if mejor_estimacion is None:
        return None

    return round(mejor_estimacion, 10)


if __name__ == "__main__":
    # 1. Configurar el lector de argumentos
    parser = argparse.ArgumentParser(description="Procesar una imagen para calcular la unidad por píxel.")
    
    # 2. Definir el argumento obligatorio para la ruta de la imagen
    parser.add_argument("imagen", type=str, help="Ruta de la imagen que se desea procesar")

    # 2b. Model ID opcional (por defecto, el configurado en MODEL_ID)
    parser.add_argument(
        "--model-id", type=str, default=MODEL_ID,
        help=f"ID del modelo a usar, según models.json (default: {MODEL_ID})",
    )
    
    # 3. Parsear los argumentos de la línea de comandos
    args = parser.parse_args()
    
    # Usar el parámetro recibido
    img_path = args.imagen
    
    print(f"Procesando la imagen: {img_path}...")
    #img_path = './pruebas/prueba4.png'
    reporte_detecciones=procesaImagen(img_path, model_id=args.model_id)
    #print(reporte_detecciones)
    mupx=calcular_mejor_unidad_px(reporte_detecciones,tau=0.3, k=3.0)
    print(f"Salida - Unidad por px mejor puntuada: {mupx}")