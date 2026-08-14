export interface CategoryPresentation {
  subtitle: string;
  featuredSubcategoryNames: readonly string[];
  relatedSearches: readonly string[];
}

const approvedPresentations: Readonly<Record<string, CategoryPresentation>> = {
  "graphics & design": {
    subtitle: "Designs to make you stand out.",
    featuredSubcategoryNames: [
      "Logo Design",
      "Architecture & Interior Design",
      "Image Editing",
      "NFT Art",
      "T-Shirts & Merchandise",
    ],
    relatedSearches: [
      "Minimalist logo design",
      "Signature logo design",
      "Mascot logo design",
      "3d logo design",
      "Hand drawn logo design",
      "Vintage logo design",
      "Remove background",
      "Photo restoration",
      "Photo retouching",
      "Image resize",
      "Product label design",
      "Custom twitch overlay",
      "Custom twitch emotes",
      "Gaming logo",
      "Children book illustration",
      "Instagram design",
      "Movie poster design",
      "Box design",
      "Logo maker",
      "Logo ideas",
    ],
  },
};

export function categoryPresentation(name: string) {
  return approvedPresentations[name.trim().toLowerCase()] ?? null;
}
