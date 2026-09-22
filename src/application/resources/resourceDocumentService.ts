import {
  RESOURCE_DOCUMENT_SCHEMA_VERSION,
  createResourceExportDocument,
  type ResourceDocumentFormat,
  type ResourceExportDocument
} from "../../domain/resources/resourceExportDocument";
import { failure, success, type Result } from "../../shared/result";

export class ResourceDocumentService<T> {
  public constructor(
    private readonly format: ResourceDocumentFormat,
    private readonly isResource: (value: unknown) => value is T
  ) {}

  public serialize(resources: readonly T[]): string {
    return JSON.stringify(createResourceExportDocument(this.format, resources), null, 2);
  }

  public deserialize(serialized: string): Result<ResourceExportDocument<T>> {
    let value: unknown;
    try {
      value = JSON.parse(serialized);
    } catch {
      return failure("El documento no contiene JSON válido.");
    }
    if (typeof value !== "object" || value === null) return failure("El documento debe ser un objeto JSON.");
    const record = value as Record<string, unknown>;
    if (record.format !== this.format) return failure(`El formato esperado es ${this.format}.`);
    if (record.schemaVersion !== RESOURCE_DOCUMENT_SCHEMA_VERSION) return failure("La versión del documento no es compatible.");
    if (typeof record.extensionVersion !== "string") return failure("El documento no indica la versión de la extensión.");
    if (!Array.isArray(record.data) || !record.data.every(this.isResource)) return failure("Los datos del documento no son válidos.");
    return success(value as ResourceExportDocument<T>);
  }
}
