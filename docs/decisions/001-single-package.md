# Paquete único

**Estado:** requerido por la Fase 1.

El repositorio utiliza un solo `package.json`, un único lockfile y un único artefacto VSIX. Las webviews son entradas de esbuild dentro del mismo paquete; no son proyectos independientes.

Esto simplifica publicación, versiones y resolución de tipos compartidos. No se introducirán workspaces, Nx, Turborepo, Lerna ni gestores equivalentes.
