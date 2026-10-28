import { arraysPage } from "./Arrays/definition";
import { aiDocumentationPage } from "./AiDocumentation/definition";
import { automationsPage } from "./Automatizaciones/definition";
import { formulasPage } from "./Formulas/definition";
import { manualPage } from "./Manual/definition";
import type { PageDefinition } from "./pageDefinition";

export const pageCatalog: readonly PageDefinition[] = [manualPage, formulasPage, arraysPage, automationsPage, aiDocumentationPage];
