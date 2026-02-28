import fitz
import re
from pathlib import Path
import json
from datetime import datetime

CARPETA_PDF = Path(r"C:\Users\perit\Desktop\panel_siniestros\peritacion_pdf")
ARCHIVO_JSON = CARPETA_PDF / "siniestros_extraidos.json"

pdfs = list(CARPETA_PDF.glob("*.pdf"))
siniestros = []

def convertir_fecha_html(fecha_texto):
    """Convierte dd/mm/yyyy a YYYY-MM-DD para que el navegador lo entienda"""
    try:
        # Limpiar posibles espacios extra
        fecha_limpia = re.sub(r'\s+', '', fecha_texto.strip())
        dt = datetime.strptime(fecha_limpia, '%d/%m/%Y')
        return dt.strftime('%Y-%m-%d')
    except:
        # Si falla, devolvemos la fecha de hoy en formato correcto
        return datetime.now().strftime('%Y-%m-%d')

def extraer_datos_pdf(pdf_path):
    doc = fitz.open(pdf_path)
    texto = ""
    for page in doc:
        texto += page.get_text()
    doc.close()
    
    # --- FECHA PERITACIÓN ---
    lineas = texto.split('\n')
    fecha_perit = datetime.now().strftime('%d/%m/%Y')
    for i, linea in enumerate(lineas):
        if 'Fecha de Peritación' in linea:
            if i+1 < len(lineas):
                fecha_perit = lineas[i+1].strip()
            break
    
    fecha_html = convertir_fecha_html(fecha_perit)
    
    # --- DETECTAR COMPAÑÍA ---
    compania = "Allianz"
    if "INTERNEXO" in texto.upper():
        compania = "Internexo"
    elif "BBVA" in texto.upper():
        compania = "BBVA Allianz"

    # --- NÚMERO SINIESTRO ---
    siniestro_match = re.search(r'Siniestro\s*(\d+)', texto)
    numeroSiniestro = siniestro_match.group(1) if siniestro_match else pdf_path.stem
    
    # --- MATRÍCULA ---
    matricula_match = re.search(r'Matrícula\s*([0-9]{4}[A-Z]{3})', texto)
    matricula = matricula_match.group(1) if matricula_match else "S/M"
    
    # --- MARCA / MODELO ---
    marca_modelo_match = re.search(r'Marca / Modelo\s*([A-Z][^\n]{1,50})', texto)
    marcaModelo = marca_modelo_match.group(1).strip() if marca_modelo_match else "Vehículo"
    
    # --- TALLER ---
    taller_matches = re.findall(r'Taller\s+Taller\s+([A-Z][^,\n]{5,50})', texto)
    taller = taller_matches[0].strip() if taller_matches else "Taller Pendiente"
    
    # --- GARANTÍA (Mejorado para captar palabras completas) ---
    garantia_match = re.search(r'Garantía\s+([^\n]{1,30})', texto)
    garantia = garantia_match.group(1).strip() if garantia_match else ""
    
    # --- COMPROMISO PAGO ---
    compromiso_match = re.search(r'Compromiso\s+([^\n]{1,20})', texto)
    compromiso = compromiso_match.group(1).strip() if compromiso_match else ""
    
    return {
        "compania": compania,
        "numeroSiniestro": numeroSiniestro,
        "fechaPeritacion": fecha_html,
        "marcaModelo": marcaModelo,
        "matricula": matricula,
        "taller": taller,
        "estado": "En curso",
        "compromisoPago": compromiso,
        "garantia": garantia,
        "fotos": [],
        "archivos": []
    }

for pdf in pdfs:
    try:
        datos = extraer_datos_pdf(pdf)
        siniestros.append(datos)
        print(f"✅ {pdf.name} -> {datos['numeroSiniestro']} ({datos['garantia']})")
    except Exception as e:
        print(f"❌ Error en {pdf.name}: {e}")

# Guardar con indentación para que sea legible
with open(ARCHIVO_JSON, 'w', encoding='utf-8') as f:
    json.dump(siniestros, f, indent=2, ensure_ascii=False)

print(f"\n🎉 Proceso terminado. {len(siniestros)} siniestros listos.")