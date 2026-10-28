# Perfiles Manual

Un perfil agrupa URL, query params, headers, cookies, localStorage, sessionStorage, overrides, generadores y viewport. Su esquema interno actual es la versión 2; el codec migra perfiles de versión 1.

El editor mantiene un borrador separado del último perfil guardado. Antes de seleccionar, crear o importar otro perfil se ofrece **Guardar**, **Descartar** o **Cancelar**. Los cambios aplicados desde **Ver JSON** siguen siendo un borrador hasta guardar.

La exportación Manual crea un paquete portátil con las fórmulas y arrays realmente referenciados. Al importar se resuelven sus identidades y se reparan los `resourceId` antes de guardar el perfil.

Los detalles de cada campo están en [manual-page.md](manual-page.md).
