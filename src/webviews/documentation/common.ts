import { t } from "../../localization";
import { CURRENT_EXTENSION_VERSION } from "../../shared/extensionVersion";
import { AUTOMATION_SCHEMA_VERSION } from "../../domain/automations/automation";

export const jsonBlock = (value: unknown): string => `\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n`;

export const introduction = (area: string): string => [
  t("documentation.introduction", { version: CURRENT_EXTENSION_VERSION, area, automationSchemaVersion: AUTOMATION_SCHEMA_VERSION }),
  t("documentation.savedData"),
  t("documentation.browserSelection")
].join("\n\n");
export const sessionReference = t("documentation.sessionReference");
export const resourceReference = `${t("documentation.resourceReference")}\n\n${t("documentation.resourceNavigation")}`;
