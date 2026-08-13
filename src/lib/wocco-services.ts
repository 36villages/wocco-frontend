/**
 * Curated service catalog for Greymoon scrape search.
 * `name` = friendly display / serviceCategory on import.
 * `search` = People Finder job title / Google Maps / Craigslist query.
 * Groups: NOW (everyday home) vs PRO (skilled trades / commercial).
 */

export type WoccoServiceGroup = "NOW" | "PRO";

export interface WoccoService {
  id: string;
  name: string;
  /** String used as People Finder job title / Google Maps / Craigslist query */
  search: string;
  group: WoccoServiceGroup;
  /**
   * Extra People Finder titles sent with `search` for sparse B2B trades.
   * Backend also expands junk/trash queries; this is for UI copy.
   */
  peopleTitleHint?: string;
}

export const WOCCO_SERVICES: WoccoService[] = [
  // ── NOW — everyday home & property services ────────────────────────────────
  { id: "house-cleaning", name: "House Cleaning", search: "House Cleaner", group: "NOW" },
  { id: "deep-cleaning", name: "Deep Cleaning", search: "Deep Cleaner", group: "NOW" },
  { id: "move-in-out-cleaning", name: "Move-In / Move-Out Cleaning", search: "Move Out Cleaner", group: "NOW" },
  { id: "apartment-cleaning", name: "Apartment Unit Cleaning", search: "Apartment Cleaner", group: "NOW" },
  { id: "carpet-cleaning", name: "Carpet Cleaning", search: "Carpet Cleaner", group: "NOW" },
  { id: "upholstery-cleaning", name: "Upholstery Cleaning", search: "Upholstery Cleaner", group: "NOW" },
  { id: "window-cleaning", name: "Window Cleaning", search: "Window Cleaner", group: "NOW" },
  { id: "pressure-washing", name: "Pressure Washing", search: "Pressure Washing", group: "NOW" },
  // People Finder expands junk/trash into related private-trade titles (Hauler, Junk Hauler, …)
  {
    id: "junk-removal",
    name: "Junk Removal",
    search: "Junk Remover",
    group: "NOW",
    peopleTitleHint:
      "Searches Junk Remover, Junk Removal Specialist, Junk Hauler, Hauler, Debris Remover, and related titles",
  },
  {
    id: "trash-removal",
    name: "Trash Removal",
    search: "Trash Remover",
    group: "NOW",
    peopleTitleHint:
      "Searches Trash Remover, Junk Remover, Junk Removal Specialist, Hauler, Debris Remover, and related titles",
  },
  { id: "furniture-moving", name: "Furniture Moving", search: "Mover", group: "NOW" },
  { id: "packing", name: "Packing Services", search: "Packer", group: "NOW" },
  { id: "furniture-assembly", name: "Furniture Assembly", search: "Furniture Assembler", group: "NOW" },
  { id: "tv-mounting", name: "TV Mounting", search: "TV Mounting", group: "NOW" },
  { id: "handyman", name: "Handyman Repairs", search: "Handyman", group: "NOW" },
  { id: "lawn-mowing", name: "Lawn Mowing", search: "Lawn Care", group: "NOW" },
  { id: "landscaping", name: "Landscaping", search: "Landscaper", group: "NOW" },
  { id: "yard-cleanup", name: "Yard Cleanup", search: "Yard Cleanup", group: "NOW" },
  { id: "leaf-removal", name: "Leaf Removal", search: "Leaf Removal", group: "NOW" },
  { id: "snow-removal", name: "Snow Removal", search: "Snow Removal", group: "NOW" },
  { id: "gutter-cleaning", name: "Gutter Cleaning", search: "Gutter Cleaning", group: "NOW" },
  { id: "pest-control", name: "Pest Control", search: "Pest Control", group: "NOW" },
  { id: "mobile-car-wash", name: "Mobile Car Wash", search: "Mobile Car Wash", group: "NOW" },
  { id: "car-detailing", name: "Car Detailing", search: "Car Detailer", group: "NOW" },
  { id: "pet-sitting", name: "Pet Sitting", search: "Pet Sitter", group: "NOW" },
  { id: "dog-walking", name: "Dog Walking", search: "Dog Walker", group: "NOW" },
  { id: "house-sitting", name: "House Sitting", search: "House Sitter", group: "NOW" },
  { id: "organizing", name: "Home Organizing", search: "Professional Organizer", group: "NOW" },
  { id: "laundry", name: "Laundry Services", search: "Laundry Service", group: "NOW" },
  { id: "pool-cleaning", name: "Pool Cleaning", search: "Pool Cleaner", group: "NOW" },

  // ── PRO — skilled trades & commercial ──────────────────────────────────────
  { id: "plumber", name: "Plumbing", search: "Plumber", group: "PRO" },
  { id: "toilet-repair", name: "Toilet Repair", search: "Toilet Repair", group: "PRO" },
  { id: "drain-cleaning", name: "Drain Cleaning", search: "Drain Cleaning", group: "PRO" },
  { id: "water-heater", name: "Water Heater Service", search: "Water Heater Technician", group: "PRO" },
  { id: "garbage-disposal", name: "Garbage Disposal Repair", search: "Garbage Disposal Repair", group: "PRO" },
  { id: "hvac", name: "HVAC Maintenance", search: "HVAC Technician", group: "PRO" },
  { id: "ac-repair", name: "AC Repair", search: "AC Repair Technician", group: "PRO" },
  { id: "ac-installer", name: "AC Installer", search: "AC Installer", group: "PRO" },
  { id: "furnace-repair", name: "Furnace Repair", search: "Furnace Repair", group: "PRO" },
  { id: "air-duct-cleaning", name: "Air Duct Cleaning", search: "Air Duct Cleaning", group: "PRO" },
  { id: "electrician", name: "Electrical Work", search: "Electrician", group: "PRO" },
  { id: "painter-interior", name: "Interior Painting", search: "Painter", group: "PRO" },
  { id: "painter-exterior", name: "Exterior Painting", search: "Exterior Painter", group: "PRO" },
  { id: "drywall-repair", name: "Drywall Repair", search: "Drywall Repair", group: "PRO" },
  { id: "flooring", name: "Flooring Installation", search: "Flooring Installer", group: "PRO" },
  { id: "tile-grout", name: "Tile & Grout", search: "Tile Installer", group: "PRO" },
  { id: "carpet-install", name: "Carpet Installation", search: "Carpet Installer", group: "PRO" },
  { id: "roofing", name: "Roofing", search: "Roofer", group: "PRO" },
  { id: "siding", name: "Siding Repair", search: "Siding Contractor", group: "PRO" },
  { id: "fencing", name: "Fence Installation", search: "Fence Installer", group: "PRO" },
  { id: "deck-repair", name: "Deck Repair", search: "Deck Builder", group: "PRO" },
  { id: "garage-door", name: "Garage Door Repair", search: "Garage Door Technician", group: "PRO" },
  { id: "locksmith", name: "Locksmith", search: "Locksmith", group: "PRO" },
  { id: "appliance-repair", name: "Appliance Repair", search: "Appliance Repair Technician", group: "PRO" },
  { id: "refrigerator-repair", name: "Refrigerator Repair", search: "Refrigerator Repair", group: "PRO" },
  { id: "washer-repair", name: "Washer / Dryer Repair", search: "Appliance Repair", group: "PRO" },
  { id: "restaurant-cleaning", name: "Restaurant / Kitchen Cleaning", search: "Restaurant Cleaner", group: "PRO" },
  { id: "commercial-cleaning", name: "Commercial Cleaning", search: "Commercial Cleaner", group: "PRO" },
  { id: "janitorial", name: "Janitorial Services", search: "Janitor", group: "PRO" },
  { id: "mold-remediation", name: "Mold Remediation", search: "Mold Remediation", group: "PRO" },
  { id: "waterproofing", name: "Waterproofing", search: "Waterproofing Contractor", group: "PRO" },
  { id: "insulation", name: "Insulation", search: "Insulation Installer", group: "PRO" },
  { id: "general-contractor", name: "General Contracting", search: "General Contractor", group: "PRO" },
];

export const WOCCO_SERVICE_GROUPS: {
  group: WoccoServiceGroup;
  label: string;
  services: WoccoService[];
}[] = [
  {
    group: "NOW",
    label: "Everyday home",
    services: WOCCO_SERVICES.filter((s) => s.group === "NOW"),
  },
  {
    group: "PRO",
    label: "Skilled trades",
    services: WOCCO_SERVICES.filter((s) => s.group === "PRO"),
  },
];

export function findWoccoService(id: string): WoccoService | undefined {
  return WOCCO_SERVICES.find((s) => s.id === id);
}
