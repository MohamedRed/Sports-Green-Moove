import { describe, expect, it } from "vitest";
import {
  GooglePlacesConfigurationError,
  GooglePlacesProvider,
  type GooglePlacesFetch,
} from "../services/googlePlaces.js";

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GooglePlacesProvider", () => {
  it("requires GOOGLE_MAPS_API_KEY for place search", async () => {
    const provider = new GooglePlacesProvider({ apiKey: "", fetcher: async () => jsonResponse({}) });

    await expect(provider.suggestPlaces("Wavre")).rejects.toBeInstanceOf(GooglePlacesConfigurationError);
  });

  it("uses Places autocomplete with Belgian French scope", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetcher: GooglePlacesFetch = async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({
        suggestions: [{
          placePrediction: {
            placeId: "place-1",
            text: { text: "Collège du Biéreau, Wavre" },
            structuredFormat: {
              mainText: { text: "Collège du Biéreau" },
              secondaryText: { text: "Wavre" },
            },
          },
        }],
      });
    };

    const provider = new GooglePlacesProvider({
      apiKey: "test-key",
      baseUrl: "https://places.test",
      fetcher,
    });
    const suggestions = await provider.suggestPlaces("Biereau");

    expect(suggestions).toEqual([{
      placeId: "place-1",
      label: "Collège du Biéreau, Wavre",
      mainText: "Collège du Biéreau",
      secondaryText: "Wavre",
    }]);
    expect(calls[0].url).toBe("https://places.test/v1/places:autocomplete");
    expect(calls[0].init.headers).toMatchObject({
      "X-Goog-Api-Key": "test-key",
      "X-Goog-FieldMask": expect.stringContaining("suggestions.placePrediction.placeId"),
    });
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({
      input: "Biereau",
      includedRegionCodes: ["be"],
      languageCode: "fr-BE",
    });
  });

  it("resolves place details to app coordinates", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetcher: GooglePlacesFetch = async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({
        id: "place-1",
        formattedAddress: "Rue du Collège 10, 1300 Wavre",
        displayName: { text: "Collège du Biéreau" },
        location: { latitude: 50.715, longitude: 4.612 },
      });
    };

    const provider = new GooglePlacesProvider({
      apiKey: "test-key",
      baseUrl: "https://places.test",
      fetcher,
    });
    const place = await provider.resolvePlace("place-1");

    expect(place.location).toEqual({ lat: 50.715, lng: 4.612 });
    expect(place.formattedAddress).toBe("Rue du Collège 10, 1300 Wavre");
    expect(calls[0].url).toBe("https://places.test/v1/places/place-1");
    expect(calls[0].init.headers).toMatchObject({
      "X-Goog-FieldMask": "id,formattedAddress,displayName,location",
    });
  });
});
