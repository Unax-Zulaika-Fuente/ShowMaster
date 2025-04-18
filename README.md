# 🎭 ShowMaster
### 🪄 Secuenciador de Espectáculos diseñado para el mago Alain Zulaika Fuente, adaptable para cualquier técnico o artista.

ShowMaster es una aplicación de escritorio basada en Electron que permite **organizar, sincronizar y gestionar secuencias de audio y video** en espectáculos en tiempo real.  
Creado originalmente para los shows del **mago Alain Zulaika Fuente**, también es útil para cualquier técnico o artista que necesite controlar la reproducción de medios en tiempo real.

---

## 🚀 Características principales
✅ Reproducción secuencial de vídeos, audios e imágenes con control avanzado (Play/Pausa, Anterior, Siguiente, Siguiente y reproducir, Volumen...).  
✅ **Soporte de formatos**:  
  - Vídeo: `mp4`, `avi`, `mkv`  
  - Audio: `mp3`, `wav`  
  - Imagen: `png`, `jpg`, `jpeg`, `gif`, `bmp`, `webp`  

✅ **Interfaz intuitiva con Drag & Drop y flechas** para organizar fácilmente tus pistas multimedia.  
✅ **Línea de tiempo secundaria** independiente para efectos de sonido, con opciones de silenciamiento automático.  
✅ **Efectos instantáneos personalizables** accesibles mediante botones rápidos con iconos emoji.  
✅ **Modo Espectáculo** para presentaciones en vivo, con una interfaz limpia y simplificada.  
✅ **Previsualización rápida** de vídeos para verificar contenido sin interrumpir la reproducción principal.  
✅ **Guardado y carga de proyectos** para reutilizar configuraciones en espectáculos recurrentes.  

---

## 🛠 Instalación
Puedes descargar la última versión desde la sección **[Releases](https://github.com/Unax-Zulaika-Fuente/ShowMaster/releases/latest)**.

Si prefieres ejecutarlo desde el código fuente, sigue estos pasos:

### 🔹 **1. Clonar el repositorio**
```sh
git clone https://github.com/Unax-Zulaika-Fuente/ShowMaster.git
cd ShowMaster
```

### 🔹 **2. Instalar dependencias**
```sh
npm install
```

### 🔹 **3. Iniciar la aplicación**
```sh
npm start
```

### 🔹 **Requisitos recomendados:**
- Node.js v22.14 o superior
- Electron v25 o superior

---

## 📦 Generar un ejecutable (Windows/Linux/Mac)
Si quieres crear un ejecutable de la aplicación, puedes hacerlo con:
```sh
npm run build
```
Esto generará un archivo instalador en la carpeta dist/.

---

## 🎮 Uso de la aplicación
1. Carga archivos de audio, vídeo e imágenes en la secuencia principal, secundaria o efectos instantáneos.
2. Organiza y reordena las pistas fácilmente mediante Drag & Drop y/o uso de flechas según tu espectáculo.
3. Reproduce contenido en una pantalla secundaria manteniendo control total durante el espectáculo.
4. Personaliza efectos instantáneos con botones rápidos y emojis.
5. Guarda tus configuraciones en proyectos para utilizarlas en futuras actuaciones.

⚠ **IMPORTANTE**:

Cuando guardas un proyecto, **ShowMaster almacena las rutas de los archivos de audio y video, pero no los copia.**  

**Si mueves o eliminas los archivos después de guardar el proyecto, ShowMaster no podrá encontrarlos y no se cargarán correctamente.**

Para evitar problemas, mantén los archivos en su ubicación original o vuelve a cargarlos en la aplicación si cambian de sitio.

---

## 📁 Tipos de archivos soportados
ShowMaster puede trabajar con estos formatos de medios:
- **Vídeo:** `mp4`, `avi`, `mkv`
- **Audio:** `mp3`, `wav`
- **Imagen:** `png`, `jpg`, `jpeg`, `gif`, `bmp`, `webp`

---

## 🔒 **Seguridad y Buenas Prácticas**
- Mantén tus archivos multimedia en ubicaciones estables y realiza copias de seguridad regularmente.
- Descarga y actualiza siempre la aplicación desde fuentes confiables (repositorio oficial).
- Mantén actualizadas las dependencias para evitar problemas de seguridad o rendimiento.

---

## 🚧 **Problemas conocidos o preguntas frecuentes**

- ¿Por qué mis vídeos no cargan tras mover los archivos originales?
  - ShowMaster guarda rutas absolutas. Si cambias la ubicación de los archivos, debes recargarlos manualmente.
- ¿Cuántas pantallas necesito para utilizar correctamente ShowMaster?
  - ShowMaster está diseñado para utilizarse con dos pantallas simultáneas. En la pantalla principal tendrás acceso completo a todos los controles de la aplicación, mientras que en la pantalla secundaria se reproducirán los vídeos y contenidos multimedia en pantalla completa y sin distracciones.

---

## 📝 Licencia
Este proyecto está bajo la **[Apache License 2.0](LICENSE)**.  
Puedes modificarlo y usarlo libremente, pero cualquier uso comercial debe incluir atribución a su creador.  
Consulta el archivo [LICENSE](LICENSE) para más detalles.

---

## 👨‍💻 Autor
🔹 **Desarrollado por:** [Unax Zulaika Fuente](https://github.com/Unax-Zulaika-Fuente)  
📩 **Email:** [unax.zulaika.fuente@gmail.com](mailto:unax.zulaika.fuente@gmail.com)  
🔗 **LinkedIn:** [Unax Zulaika Fuente](https://www.linkedin.com/in/unax-zulaika-fuente/)

---

## ⭐ Contribuir
Si quieres mejorar ShowMaster, puedes hacer un fork y enviar un pull request. ¡Toda ayuda es bienvenida!
También puedes abrir un issue si encuentras algún problema.

---
## 💡 Agradecimientos
A  [Alain Zulaika Fuente](https://www.alainzulaika.com/) por la inspiración para este proyecto.

🎭✨ ¡Que comience el espectáculo! ✨🎭
