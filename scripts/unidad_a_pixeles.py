#!/usr/bin/env python
# coding: utf-8

#pip install scikit-image
#pip install pytesseract pillow
#pip install easyocr
# Para ejecutar en CPU:
#!pip install rapidocr_onnxruntime
# O si quieres usar tu GPU (requiere ONNX Runtime con soporte CUDA):
#!pip install rapidocr_onnxruntime[gpu]

import re

def limpiar_numeros_ocr(texto_ocr):
    # 1. Limpieza básica de espacios y basura textual del OCR
    texto = texto_ocr.strip()

    # Si no hay caracteres numéricos, salir temprano
    if not any(char.isdigit() for char in texto):
        return 0.0

    # 2. CASO A: Formato Europeo/Argentino (1.250,45 o simplemente 15,45)
    # Si hay una coma cerca del final (1 o 2 dígitos decimales) y opcionalmente puntos antes
    if ',' in texto and ('.' not in texto or texto.find('.') < texto.find(',')):
        partes = texto.split(',')
        # Verificamos si lo que sigue a la coma NO son 3 dígitos (para no confundir con un "1,500" americano)
        if len(partes) == 2 and len(partes[1]) != 3:
            texto = texto.replace('.', '')  # Elimina puntos de miles
            texto = texto.replace(',', '.')  # Convierte la coma decimal en punto
            return _convertir_a_float(texto)

    # 3. CASO B: Formato Americano / Genérico (1,250.45 o 1,500 o 15.45)
    # Primero aislamos si hay un punto decimal real al final
    if '.' in texto:
        partes = texto.split('.')
        # Si la última parte no tiene 3 dígitos, el punto es definitivamente el decimal
        if len(partes[-1]) != 3:
            # Eliminamos todas las comas (que actúan como miles)
            texto = texto.replace(',', '')
            return _convertir_a_float(texto)

    # 4. CASO C: Números enteros con comas de miles (ej: "1,500" -> 1500.0)
    # Si tiene una coma seguida de exactamente 3 dígitos al final de la cadena
    if re.search(r',\d{3}$', texto):
        texto = texto.replace(',', '')
        return _convertir_a_float(texto)

    # 5. CASO D: Números enteros con puntos de miles (ej: "1.500" -> 1500.0)
    if re.search(r'\.\d{3}$', texto):
        texto = texto.replace('.', '')
        return _convertir_a_float(texto)

    # Caída de emergencia para casos limpios estándar (ej: "15.45" o "120")
    texto = texto.replace(',', '.')
    return _convertir_a_float(texto)

def _convertir_a_float(string_limpio):
    """Función auxiliar para castear de forma segura."""
    try:
        return float(string_limpio)
    except ValueError:
        # Si el OCR leyó caracteres mezclados irreconocibles, devuelve 0.0
        return 0.0

import cv2
from rapidocr_onnxruntime import RapidOCR #rapidOCR fork de paddleOCR
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

import cv2
import numpy as np
from skimage.morphology import skeletonize

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

import cv2
import math
import ultralytics
from ultralytics import YOLO
#import easyocr  # Inicializa el lector de OCR (puedes cambiarlo por pytesseract si prefieres)
import pytesseract
import matplotlib.pyplot as plt
from paddleocr import PaddleOCR

def procesaImagen(img_path):
    # Indicar a Jupyter que muestre los gráficos en línea (opcional pero recomendado)
    #get_ipython().run_line_magic('matplotlib', 'inline')

    # Inicializar el lector de OCR para español/inglés
    #reader = easyocr.Reader(['es', 'en'])

    # Cargar el modelo entrenado
    model = YOLO('./modelo/best.pt')

    # Predecir (Guardamos también la imagen original en memoria para el recorte)

    results = model.predict(imgsz=1024, source=img_path, conf=0.1)

    # Cargar la imagen con OpenCV para poder recortar la zona del OCR
    img_original = cv2.imread(img_path)

    # Lista donde guardaremos el objeto analítico de cada detección
    reporte_detecciones = []

    ind=0
    for r in results:

        # 2. Acceder al atributo de las cajas detectadas
        boxes = r.boxes

        # r.keypoints.xy devuelve un tensor de forma (num_personas, num_keypoints, 2)
        # Si usamos [0] asumimos que estamos procesando la primera detección del set
        #if r.keypoints is not None and len(r.keypoints.xy) > 0:
        for idx, k in enumerate(r.keypoints):
            #print("-----------------------------------------------------------")
            kp = k.xy[0].cpu().numpy() # Convertimos a array de numpy para facilitar manejo
            precision=boxes[ind].conf[0].item()
            distancia_px = 0.0
            dimension_real = 0.0
            texto_ocr = ""
            relacion_px_metro = 0.0

            ind=ind+1
            # --- 1. DISTANCIA ENTRE LOS DOS PRIMEROS PUNTOS ---
            distancia = 0
            dimension = 0

            if len(kp) >= 2:
                p1 = kp[0] # [x1, y1]
                p2 = kp[1] # [x2, y2]

                # Verificar que los puntos no sean [0, 0] (no detectados)
                if p1[0] != 0 and p2[0] != 0:
                    distancia = math.sqrt((p2[0] - p1[0])**2 + (p2[1] - p1[1])**2)
                    #print(f"Distancia entre el punto 1 y el punto 2: {distancia:.2f} píxeles")
                else:
                    print("Uno de los dos primeros puntos no fue detectado.")

            # --- 2. OCR ALREDEDOR DEL TERCER PUNTO ---
            if len(kp) >= 3:
                p3 = kp[2] # [x3, y3]

                if p3[0] != 0 and p3[1] != 0:
                    x_c, y_c = int(p3[0]), int(p3[1])

                    # Definir el tamaño del margen alrededor del punto para el OCR (puedes ajustar este tamaño)
                    margen_x = 50  
                    margen_y = 30  

                    # Coordenadas del recorte (asegurando no salirnos de los límites de la imagen)
                    h_img, w_img, _ = img_original.shape
                    x1_crop = max(0, x_c - margen_x)
                    y1_crop = max(0, y_c - margen_y)
                    x2_crop = min(w_img, x_c + margen_x)
                    y2_crop = min(h_img, y_c + margen_y)

                    # Recortar la región de interés (ROI)
                    roi = img_original[y1_crop:y2_crop, x1_crop:x2_crop]

                    roiopt=optimizar_imagen_en_memoria_opencv(roi)                    

                    # 2. Mostrar la imagen en Jupyter
                    #roi_rgb = cv2.cvtColor(roi, cv2.COLOR_BGR2RGB)
                    #plt.figure(figsize=(3, 3)) # Puedes ajustar el tamaño visual de la imagen aquí
                    #plt.imshow(roi_rgb)
                    #plt.title(f"ROI - Det {ind}")
                    #plt.axis('off') # Oculta los ejes numéricos (píxeles)
                    #plt.show()

                    #roi_rgb1 = cv2.cvtColor(roiopt, cv2.COLOR_BGR2RGB)
                    #plt.figure(figsize=(3, 3)) # Puedes ajustar el tamaño visual de la imagen aquí
                    #plt.imshow(roi_rgb1)
                    #plt.title(f"ROI - Det {ind}")
                    #plt.axis('off') # Oculta los ejes numéricos (píxeles)
                    #plt.show()
                    # Aplicar OCR en el recorte
                    if roi.size > 0:

                        # 2. Convertir la imagen a texto (Por defecto busca texto en inglés)
                        #texto = pytesseract.image_to_string(roi).strip()
                        #print("Texto extraído:")
                        #print(texto)
                        texto_ocr=extraeRapidOCR(roi)
                        #print(texto_ocr);
                        texto_ocr1=extraeRapidOCR(roiopt)
                        #print(texto_ocr1);

                        #ocr_result = reader.readtext(roi)
                        # Unir el texto detectado en caso de que encuentre múltiples líneas
                        #texto_detectado = " ".join([res[1] for res in ocr_result])
                        #print(f"Texto detectado alrededor del tercer punto: '{texto_detectado}'")

                        if len(texto_ocr)>0:
                          #print(f"Texto detectado alrededor del tercer punto: '{texto_ocr[0]['texto']}'")  
                          dimension=limpiar_numeros_ocr(texto_ocr[0]['texto'])

                    else:
                        print("La región de recorte está vacía.")
                else:
                    print("El tercer punto no fue detectado.")
            #print(f"{distancia} {dimension}")        
            #if (distancia != 0 and dimension != 0):
            #    print( f"1 metro {distancia/dimension} pixeles")
            deteccion_data = {
                "nro_deteccion": idx + 1,
                "precision_bbox": round(precision, 4),
                "texto_detectado": texto_ocr,
                "dimension_real": dimension,
                "distancia_px": round(distancia, 2),
                "unidad_por_px": round(dimension/distancia, 10) if dimension != 0 else 0 #metros por pixel
            }

            reporte_detecciones.append(deteccion_data)
    return reporte_detecciones       

import numpy as np

def calcular_mejor_unidad_px(detecciones, tau=0.3, k=3.0):
    """
    Calcula la mejor estimación de unidad_por_px usando el pipeline del archivo:
    Filtro de Confianza -> Filtro MAD -> Media Ponderada.

    :param detecciones: Lista de diccionarios con la estructura de 'deteccion_data'
    :param tau: Umbral de confianza mínimo (Confidence threshold)
    :param k: Multiplicador MAD para el descarte de outliers
    :return: Mejor estimación de unidad_por_px (float) o None si no hay datos válidos
    """
    # ---------------------------------------------------------
    # PASO 1: Filtro de Confianza (Confidence Gate)
    # ---------------------------------------------------------
    # 1. Definimos el filtro como una función pura (lambda)
    paso_filtro = lambda d: d["unidad_por_px"] > 0 and d["precision_bbox"] >= tau

    # 2. Aplicamos el filtro convirtiendo el iterador resultante en una lista
    detecciones_filtradas = list(filter(paso_filtro, detecciones))

    if not detecciones_filtradas:
        print("Error: Ninguna detección pasó el filtro de confianza mínimo.")
        return None

    # Extraer las escalas (E) de las detecciones que pasaron el primer filtro
    escalas = np.fromiter(map(lambda d: d["unidad_por_px"], detecciones_filtradas), dtype=float)

    # ---------------------------------------------------------
    # PASO 2: Filtro MAD (Median Absolute Deviation)
    # ---------------------------------------------------------
    mediana = np.median(escalas)
    # Desviación absoluta respecto a la mediana
    dev_absoluta = np.abs(escalas - mediana)
    mad = np.median(dev_absoluta)

    # Evitar división por cero si todas las escalas son idénticas
    if mad == 0:
        mad = 1e-9 

    # Factor de consistencia para distribución normal (1.4826)
    mad_g = mad * 1.4826

    # Puntuación Z de MAD para cada elemento
    mad_z_scores = dev_absoluta / mad_g

    # Filtrar las detecciones que pasan el criterio de Outliers (z-score < k)
    # Emparejamos cada detección con su z-score y filtramos directamente
    detecciones_finales = [d for d, z_score in zip(detecciones_filtradas, mad_z_scores) if z_score <= k]        

    if not detecciones_finales:
        print("Error: Todas las detecciones fueron clasificadas como outliers por el filtro MAD.")
        return None

    # ---------------------------------------------------------
    # PASO 3: Cálculo de la Media Ponderada (Weighted Mean)
    # ---------------------------------------------------------
    sum_w_por_E = 0.0
    sum_w = 0.0

    for d in detecciones_finales:
        # Peso (w) = Confianza (B) × Distancia (D)
        w = d["precision_bbox"] * d["distancia_px"]
        E = d["unidad_por_px"]

        sum_w_por_E += w * E
        sum_w += w

    if sum_w == 0:
        return None

    # Mejor estimación (Weighted Mean)
    mejor_estimacion = sum_w_por_E / sum_w

    return round(mejor_estimacion, 10)

import argparse

if __name__ == "__main__":
    # 1. Configurar el lector de argumentos
    parser = argparse.ArgumentParser(description="Procesar una imagen para calcular la unidad por píxel.")
    
    # 2. Definir el argumento obligatorio para la ruta de la imagen
    parser.add_argument("imagen", type=str, help="Ruta de la imagen que se desea procesar")
    
    # 3. Parsear los argumentos de la línea de comandos
    args = parser.parse_args()
    
    # Usar el parámetro recibido
    img_path = args.imagen
    
    print(f"Procesando la imagen: {img_path}...")
    #img_path = './pruebas/prueba4.png'
    reporte_detecciones=procesaImagen(img_path)
    #print(reporte_detecciones)
    mupx=calcular_mejor_unidad_px(reporte_detecciones,tau=0.3, k=3.0)
    print(f"Salida - Unidad por px mejor puntuada: {mupx}")





