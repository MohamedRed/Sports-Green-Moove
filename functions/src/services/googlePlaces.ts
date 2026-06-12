import type { PlaceSuggestion, ResolvedPlace } from "../domain/types.js";

export type GooglePlacesFetch = (url: string, init: RequestInit) => Promise<FetchResponse>;

type FetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
  text(): Promise<string>;
};

type GooglePlacesProviderOptions = {
  apiKey?: string;
  baseUrl?: string;
  fetcher?: GooglePlacesFetch;
};

type AutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
};

type PlaceDetailsResponse = {
  id?: string;
  formattedAddress?: string;
  displayName?: { text?: string };
  location?: {
    latitude?: number;
    longitude?: number;
  };
};

const autocompleteFieldMask = [
  "suggestions.placePrediction.placeId",
  "suggestions.placePrediction.text.text",
  "suggestions.placePrediction.structuredFormat.mainText.text",
  "suggestions.placePrediction.structuredFormat.secondaryText.text",
].join(",");

const placeDetailsFieldMask = "id,formattedAddress,displayName,location";

export class GooglePlacesConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GooglePlacesConfigurationError";
  }
}

export class GooglePlacesProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: GooglePlacesFetch;

  constructor(options: GooglePlacesProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.GOOGLE_MAPS_API_KEY ?? "";
    this.baseUrl = options.baseUrl ?? "https://places.googleapis.com";
    this.fetcher = options.fetcher ?? fetch;
  }

  async suggestPlaces(input: string): Promise<PlaceSuggestion[]> {
    const trimmed = input.trim();
    if (trimmed.length < 3) return [];

    const response = await this.requestJson<AutocompleteResponse>(
      "/v1/places:autocomplete",
      {
        method: "POST",
        body: JSON.stringify({
          input: trimmed,
          includedRegionCodes: ["be"],
          languageCode: "fr-BE",
        }),
      },
      autocompleteFieldMask,
    );

    return (response.suggestions ?? []).flatMap((suggestion) => {
      const prediction = suggestion.placePrediction;
      const placeId = prediction?.placeId;
      const label = prediction?.text?.text;
      if (!placeId || !label) return [];
      return [{
        placeId,
        label,
        mainText: prediction?.structuredFormat?.mainText?.text,
        secondaryText: prediction?.structuredFormat?.secondaryText?.text,
      }];
    });
  }

  async resolvePlace(placeId: string): Promise<ResolvedPlace> {
    const id = placeId.trim();
    if (!id) throw new GooglePlacesConfigurationError("placeId is required.");

    const response = await this.requestJson<PlaceDetailsResponse>(
      `/v1/places/${encodeURIComponent(id)}`,
      { method: "GET" },
      placeDetailsFieldMask,
    );

    const lat = response.location?.latitude;
    const lng = response.location?.longitude;
    if (typeof lat !== "number" || typeof lng !== "number") {
      throw new Error("Google Place Details did not return a location.");
    }

    const label = response.displayName?.text ?? response.formattedAddress ?? response.id ?? id;
    return {
      placeId: response.id ?? id,
      label,
      mainText: response.displayName?.text,
      secondaryText: response.formattedAddress,
      formattedAddress: response.formattedAddress ?? label,
      location: { lat, lng },
    };
  }

  private async requestJson<T>(path: string, init: RequestInit, fieldMask: string): Promise<T> {
    if (!this.apiKey) {
      throw new GooglePlacesConfigurationError("GOOGLE_MAPS_API_KEY is required for Google Places search.");
    }

    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": fieldMask,
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      throw new Error(`Google Places request failed (${response.status} ${response.statusText}): ${details}`);
    }

    return response.json() as Promise<T>;
  }
}
