import { randomUUID } from "node:crypto";
import { createAutomationDocument, type AutomationDocument } from "../../domain/automations/automation";
import { validateAutomationDocument } from "../../domain/automations/automationValidation";
import type { SingletonDataDao } from "../persistence/applicationDataDao";
import type { NodeRegistry } from "./nodeRegistry";
import { AutomationImportService } from "../importExport/automationImportService";

export class AutomationService {
  private document: AutomationDocument | null = null;
  private readonly imports = new AutomationImportService();
  public constructor(private readonly automationDao: SingletonDataDao<AutomationDocument>, private readonly registry: NodeRegistry) {}
  public async initialize(): Promise<void> { this.document = await this.automationDao.load() ?? createAutomationDocument(randomUUID()); }
  public get(): AutomationDocument { if (this.document === null) throw new Error("AutomationService no está inicializado."); return structuredClone(this.document); }
  public async save(draft: AutomationDocument): Promise<AutomationDocument> {
    const validation = validateAutomationDocument(draft, this.registry); if (!validation.ok) throw new Error(validation.error);
    const saved = { ...structuredClone(draft), updatedAt: new Date().toISOString() };
    await this.automationDao.save(saved); this.document = saved; return structuredClone(saved);
  }
  public async import(document: AutomationDocument): Promise<AutomationDocument> {
    if (this.document === null) throw new Error("AutomationService no está inicializado.");
    const importedValidation = validateAutomationDocument(document, this.registry);
    if (!importedValidation.ok) throw new Error(importedValidation.error);
    return this.save(this.imports.merge(this.document, importedValidation.value, randomUUID));
  }
}
