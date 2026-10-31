# Perfiles Manual

Un perfil agrupa URL, query params, headers, cookies, localStorage, sessionStorage, overrides, generadores y viewport. Su esquema interno actual es la versión 2; el codec migra perfiles de versión 1.

El editor mantiene un borrador separado del último perfil guardado. Antes de seleccionar, crear o importar otro perfil se ofrece **Guardar**, **Descartar** o **Cancelar**. Los cambios aplicados desde **Ver JSON** siguen siendo un borrador hasta guardar.

Al volver a abrir Manual se recupera el perfil guardado seleccionado con sus campos, cookies, headers y preferencias. El selector solo muestra perfiles cuyo archivo existe. Si uno falta, importa una copia de seguridad; el nombre del catálogo no permite reconstruir sus datos. Si no queda ningún perfil guardado, trabaja con un borrador nuevo y guárdalo para conservarlo.

Los perfiles antiguos compatibles se actualizan automáticamente al abrirlos o importarlos. No cambies su versión a mano para resolver errores: conserva el archivo original y revisa el aviso. Una lectura o conversión fallida no sobrescribe el archivo. Guardar conserva la configuración, no la sesión viva del navegador.

La exportación Manual crea un paquete portátil con las fórmulas y arrays realmente referenciados. Al importar se resuelven sus identidades y se reparan los `resourceId` antes de guardar el perfil.

Los detalles de cada campo están en [manual-page.md](manual-page.md).
