import { t } from "../../localization";
import { CURRENT_EXTENSION_VERSION } from "../../domain/importExport/importExportDocument";

export const jsonBlock = (value: unknown): string => `\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n`;

export const introduction = (area: string): string => t("documentation.introduction", { version: CURRENT_EXTENSION_VERSION, area });
export const sessionReference = t("documentation.sessionReference");
export const resourceReference = `${t("documentation.resourceReference")}\n\n${t("documentation.resourceNavigation")}`;
