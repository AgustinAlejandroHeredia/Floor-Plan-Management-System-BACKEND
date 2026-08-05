#!/usr/bin/env python
# coding: utf-8

#pip install -U scikit-image imagecodecs
#pip install -U sahi
#pip install -U ultralytics
#pip install -U gdown                      # para descargar el modelo desde Google Drive
#
# Nota: este script importa download_model() y get_model_from_manifest()
# desde inference_engine.py, que debe estar en el mismo directorio (o en
# el PYTHONPATH).

import sys
import json
from pathlib import Path
import math
from ultralytics import YOLO
from typing import Optional
import inference_engine
from inference_engine import download_model, get_model_from_manifest
import matplotlib.pyplot as plt
# --- Configuración del modelo (manifest + descarga desde Google Drive) ---
# Igual que en unidad_a_pixeles.py: el modelo se resuelve contra
# models/models.json y se descarga (o se toma de caché local) en lugar de
# depender de un .pt copiado a mano en ./modelo/best.pt
#
# NOTA: todavía no hay entrada para este modelo en models.json. Hay que
# agregar lo siguiente al array "models" (ajustá "id"/"version" si ya
# tenés una convención propia para nombrarlo):
#   {
#     "id": "v1.0-yoloPoseArrow-OrientationDetector",
#     "version": "1.0",
#     "drive_id": "1hZyzZ4kZ_9oMqhA0PAbBXkV8wgLQHki0",
#     "model_type": "ultralytics"
#   }
ORIENTATION_MODEL_ID = "v1.2-yolo11mPodr-NorthDirectionDetector"

# Se ancla la ubicación de "models/" al archivo inference_engine.py (mismo
# criterio que usa su propio main(): base_dir = parent.parent), así el
# manifest/caché resuelto es siempre el mismo sin importar desde qué
# directorio se invoque este script.
_BASE_DIR = Path(inference_engine.__file__).resolve().parent.parent
MANIFEST_PATH = _BASE_DIR / "models" / "models.json"
CACHE_DIR = _BASE_DIR / "models" / "cache"


def cargar_modelo_orientacion(model_id=ORIENTATION_MODEL_ID):
    """
    Resuelve el modelo de orientacion.py en el manifest (models/models.json)
    y lo descarga desde Google Drive si todavía no está en caché local
    -reutilizando download_model()/get_model_from_manifest() de
    inference_engine.py-. Devuelve el path local (str) al .pt ya descargado,
    listo para usar tanto con YOLO(...) como con
    AutoDetectionModel.from_pretrained(...).

    Raises
    ------
    FileNotFoundError : si el manifest no existe, el model_id todavía no
                         está registrado en él, o la descarga no generó
                         el archivo esperado
    """
    model_meta = get_model_from_manifest(model_id, MANIFEST_PATH)
    if not model_meta:
        raise FileNotFoundError(
            f"Model ID '{model_id}' no encontrado en el manifest: {MANIFEST_PATH}\n"
            f"Agregá esta entrada al array \"models\" de models.json:\n"
            + json.dumps(
                {
                    "id": model_id,
                    "version": "1.0",
                    "drive_id": ORIENTATION_MODEL_DRIVE_ID,
                    "model_type": "ultralytics",
                },
                indent=2,
                ensure_ascii=False,
            )
        )

    ext = ".pt" if model_meta.get("model_type") == "ultralytics" else ".pth"
    local_model_path = CACHE_DIR / f"{model_meta['id']}_v{model_meta['version']}{ext}"

    download_model(model_meta["drive_id"], str(local_model_path))

    if not local_model_path.exists():
        raise FileNotFoundError(
            f"La descarga no generó el archivo esperado: {local_model_path}"
        )

    print(f"[+] Modelo de orientación listo en: {local_model_path}", file=sys.stderr)
    return str(local_model_path)


MODELO_ENTRENADO = cargar_modelo_orientacion()

model= YOLO(MODELO_ENTRENADO)




def calcular_angulo(p1,p2, en_grados=True):

    #llevo el sur a (0,0)
    xa,ya=p1
    xa2, ya2 = p2
    x1=xa-xa2
    y1 =ya2-ya #se invierte porque está invertido el plano


    x2=0
    y2=0

    #print (x1,y1,x2,y2)
    # Diferencias de coordenadas
    #dx = x2 - x1
    #dy = y2 - y1

    # math.atan2(dy, dx) calcula el ángulo en radianes 
    # y maneja correctamente los cuadrantes y el caso de dx = 0.
    angulo_rad = math.atan2(x1, y1)
    #print(angulo_rad)

    # Para obtener el ángulo de inclinación de la recta en [0°, 180°):
    if en_grados:
        angulo_grados = math.degrees(angulo_rad)
        # Ajuste para [0°, 180°):
        #if angulo_grados >= 180:
        #   return angulo_grados - 180
        return angulo_grados
    else:
        # Ajuste para [0, pi):
        #if angulo_rad >= math.pi:
         #   return angulo_rad - math.pi
        return angulo_rad

def prediccion_una_imagen(roi,confianza_kp)-> int | None:

 angulor= None   
 w=roi.shape[1]
 h=roi.shape[0]

 #-> int | Noneprint(w, h)   

 results=model(roi)   
 for r in results:
      if r.keypoints is not None and len(r.keypoints) > 0:
       keypoints = r.keypoints.xy.int().cpu().numpy()  # get the keypoints  
       keypoints_conf = r.keypoints.conf.cpu().numpy()    # Confianzas (N, Num_Kpts)
       if len(keypoints)>0:
         confianzas_primer_objeto = keypoints_conf[0]  

         #img_array = r.plot(kpt_line=True, kpt_radius=4)  # plot a BGR array of predictions
         #im = Image.fromarray(img_array[..., ::-1])  # Convert array to a PIL Image
         #plt.imshow(im)#im.show()
         #plt.show() 
         # Filtrar: Asegurar que los keypoints necesarios superen el umbral
         # Ejemplo: Verificar si los dos primeros keypoints son confiables  
         #print("Confianza punto norte",confianzas_primer_objeto[0]," sur ",confianzas_primer_objeto[1])   
         if confianzas_primer_objeto[0] > confianza_kp and confianzas_primer_objeto[1] > confianza_kp: 
            angulor=calcular_angulo(keypoints[0][0],keypoints[0][1])

 return angulor     


# In[24]:


from sahi import AutoDetectionModel
#from sahi.utils.cv import read_image
from sahi.predict import get_sliced_prediction #get_prediction, , predict
#from IPython.display import Image
import re 
import cv2
from PIL import Image, ImageDraw
import matplotlib.pyplot as plt

def busca(image_path):

 detection_model = AutoDetectionModel.from_pretrained(
    model_type="ultralytics",
    model_path=MODELO_ENTRENADO, # any yolov8/yolov9/yolo11/yolo12/rt-detr det model is supported
    confidence_threshold=0.3,
    device='cuda:0', # or 'cuda:0' if GPU is available
 )
 #<sahi.prediction.PredictionResult object at 0x71e27c741c50>
 result = get_sliced_prediction(
    image_path,
    detection_model,
    slice_height = 640,
    slice_width = 640,
    overlap_height_ratio = 0.4,
    overlap_width_ratio = 0.4
 )

 #result.export_visuals(export_dir="demo_data/", hide_conf=False)
 #img=cv2.imread("demo_data/prediction_visual.png") 

 #img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB) # Convertir a RGB
 #plt.figure(figsize=(15, 10)) # Increase size for better detail 
 #plt.imshow(img_rgb)
 #plt.axis('off') # Opcional: quita los ejes para que se vea mejor
 #plt.show() 


 object_prediction_list = result.object_prediction_list

 image = cv2.imread(image_path)
 angulos=[]   
 for a in object_prediction_list:

    print(a.bbox.minx,a.bbox.miny,a.bbox.maxx,a.bbox.maxy)
    roi = image[int(a.bbox.miny):int(a.bbox.maxy), int(a.bbox.minx):int(a.bbox.maxx)].copy()
    angulo=prediccion_una_imagen(roi,confianza_kp=0.4)
    #print("ANGULO ",angulo)
    if (angulo != None):
        angulos.append(angulo) 
    #plt.imshow(roi)
    #plt.show() 


       #draw = ImageDraw.Draw(im)
  #keypoints = a.keypoints.to_xyc()
  #print(keypoints)
 return angulos 

import sys

if __name__ == "__main__":
    # Verificar si se pasó el argumento de la imagen
    if len(sys.argv) < 2:
        print("Error: No se proporcionó ninguna imagen.")
        print("Uso correcto: python orientacion.py <ruta_de_la_imagen>")
        sys.exit(1)
        
    # El primer argumento (sys.argv[1]) es la ruta de la imagen
    ruta_imagen = sys.argv[1]
    print(f"Procesando la imagen: {ruta_imagen}\n" + "-"*40)
    
    # Ejecutar la función de búsqueda con el parámetro dinámico
    resultados_angulos = busca(ruta_imagen)
    
    print("-"*40)
    print(f"Ángulos detectados: {resultados_angulos}")



