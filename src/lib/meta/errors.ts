/**
 * Typed Errors for Meta AI Integration
 */

export class MetaApiError extends Error {
  public readonly statusCode?: number;
  public readonly code: string;
  public readonly retryable: boolean;

  constructor(message: string, code = "META_API_ERROR", statusCode?: number, retryable = false) {
    super(message);
    this.name = "MetaApiError";
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export class MetaTimeoutError extends MetaApiError {
  constructor(message = "Meta API request timed out before receiving a response.") {
    super(message, "META_TIMEOUT", 408, true);
    this.name = "MetaTimeoutError";
  }
}

export class MetaRateLimitError extends MetaApiError {
  constructor(message = "Meta API rate limit reached. Please wait before retrying.") {
    super(message, "META_RATE_LIMIT", 429, true);
    this.name = "MetaRateLimitError";
  }
}

export class MetaRefusalError extends MetaApiError {
  constructor(message = "Model refused to process the request due to content safety policies.") {
    super(message, "META_REFUSAL", 400, false);
    this.name = "MetaRefusalError";
  }
}

export class MetaModelNotAvailableError extends MetaApiError {
  constructor(modelId: string) {
    super(`Meta model '${modelId}' is currently unavailable or API key lacks permission.`, "META_MODEL_UNAVAILABLE", 503, true);
    this.name = "MetaModelNotAvailableError";
  }
}

export class SamParserError extends MetaApiError {
  constructor(message = "Failed to parse streaming SAM 3.1 video response format.") {
    super(message, "SAM_PARSER_ERROR", 500, false);
    this.name = "SamParserError";
  }
}

export class UnsupportedMediaError extends MetaApiError {
  constructor(message = "Video format or resolution is unsupported for Meta visual processing. Prefer MP4/H.264 at 720p.") {
    super(message, "UNSUPPORTED_MEDIA", 415, false);
    this.name = "UnsupportedMediaError";
  }
}

export class MissingConsentError extends MetaApiError {
  constructor(message = "Client has not consented to optional Meta AI processing.") {
    super(message, "MISSING_AI_CONSENT", 403, false);
    this.name = "MissingConsentError";
  }
}
