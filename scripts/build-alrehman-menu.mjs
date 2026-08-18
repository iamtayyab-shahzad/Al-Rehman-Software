/** One-shot generator for shared/menu.json from the printed fast-food flyers. */
import { copyFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const img = "/products/placeholder.svg";

const cid = (n) =>
  `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const pid = (n) =>
  `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const STANDARD_SIZES = [
  { name: "Personal", price: 500 },
  { name: "Small", price: 549 },
  { name: "Medium", price: 1099 },
  { name: "Large", price: 1399 },
  { name: "XL", price: 1799 },
];

const categories = [
  { id: cid(1), name: "Deals", slug: "deals", image: img, displayOrder: 1 },
  {
    id: cid(2),
    name: "Standard Pizza",
    slug: "standard-pizza",
    image: img,
    displayOrder: 2,
  },
  {
    id: cid(3),
    name: "Premium Pizza",
    slug: "premium-pizza",
    image: img,
    displayOrder: 3,
  },
  { id: cid(4), name: "Burgers", slug: "burgers", image: img, displayOrder: 4 },
  { id: cid(5), name: "Fries", slug: "fries", image: img, displayOrder: 5 },
  { id: cid(6), name: "Pasta", slug: "pasta", image: img, displayOrder: 6 },
  {
    id: cid(7),
    name: "Wings & Snacks",
    slug: "wings-snacks",
    image: img,
    displayOrder: 7,
  },
  {
    id: cid(8),
    name: "Rolls & Shawarma",
    slug: "rolls-shawarma",
    image: img,
    displayOrder: 8,
  },
  { id: cid(9), name: "Broast", slug: "broast", image: img, displayOrder: 9 },
  {
    id: cid(10),
    name: "Sandwiches",
    slug: "sandwiches",
    image: img,
    displayOrder: 10,
  },
  { id: cid(11), name: "Chinese", slug: "chinese", image: img, displayOrder: 11 },
  {
    id: cid(12),
    name: "Chowmein",
    slug: "chowmein",
    image: img,
    displayOrder: 12,
  },
  { id: cid(13), name: "Nachos", slug: "nachos", image: img, displayOrder: 13 },
];

let n = 0;
const products = [];
function add(category, name, description, sizes, featured = false) {
  n += 1;
  products.push({
    id: pid(n),
    category,
    name,
    description,
    image: img,
    featured,
    sizes,
  });
}
const one = (price) => [{ name: "Regular", price }];

add(
  "deals",
  "One Man Show",
  "Fried drum stick + regular fries + regular drink.",
  one(349),
  true,
);
add(
  "deals",
  "One Person Deal",
  "1 zinger burger + regular fries + 1 regular drink.",
  one(499),
  true,
);
add(
  "deals",
  "Midnight Deal",
  "1 large pizza + 1 pasta + 1 litre drink.",
  one(1900),
  true,
);
add(
  "deals",
  "Small Deal",
  "3 small pizzas + 1 litre drink.",
  one(1500),
);
add(
  "deals",
  "Family Deal",
  "1 extra large pizza + 1 medium pizza + 1 litre drink.",
  one(2999),
  true,
);

add(
  "standard-pizza",
  "Fajita Pizza",
  "Chicken fajita pizza.",
  STANDARD_SIZES,
  true,
);
add("standard-pizza", "Chicken Tikka", "Chicken tikka pizza.", STANDARD_SIZES);
add("standard-pizza", "Smokey BBQ", "Smokey BBQ chicken pizza.", STANDARD_SIZES);
add(
  "standard-pizza",
  "Special",
  "House special pizza.",
  STANDARD_SIZES,
);

add(
  "premium-pizza",
  "Crown Crust",
  "Special sauce pizza with crown kebab, onion, capsicum, tikka chicken, mughlai chicken and cheese.",
  [
    { name: "Medium", price: 1200 },
    { name: "Large", price: 1600 },
    { name: "XL", price: 2000 },
  ],
  true,
);
add(
  "premium-pizza",
  "Kebab Crust",
  "Stuffed crust pizza with kebab, onion, tomato, jalapeno, mughlai chicken, black olive, mushroom, cheese and signature sauce.",
  [
    { name: "Medium", price: 1200 },
    { name: "Large", price: 1600 },
    { name: "XL", price: 1900 },
  ],
);
add(
  "premium-pizza",
  "Cheese Lover",
  "Special sauce pizza loaded with extra cheese, chicken and veggies.",
  [
    { name: "Medium", price: 1200 },
    { name: "Large", price: 1600 },
    { name: "XL", price: 1900 },
  ],
);
add(
  "premium-pizza",
  "Malai Boti",
  "Special sauce, malai chicken, onion, capsicum, cheese and jalapeno with signature kababish sauce.",
  [
    { name: "Medium", price: 1200 },
    { name: "Large", price: 1600 },
    { name: "XL", price: 1900 },
  ],
);
add(
  "premium-pizza",
  "Peproni",
  "Pizza with mughlai sauce, peproni, cheese and capsicum.",
  [
    { name: "Medium", price: 1200 },
    { name: "Large", price: 1600 },
    { name: "XL", price: 1900 },
  ],
);

add("burgers", "Zinger Burger", "Crispy zinger burger.", one(320), true);
add("burgers", "Peti Burger", "Peti burger.", one(280));
add("burgers", "Chapli Burger", "Chapli burger.", one(280));
add("burgers", "Sulet Burger", "Sulet burger.", one(400));
add("burgers", "Beef Burger", "Beef burger.", one(500));
add("burgers", "RH Special Burger", "Al-rehman special burger.", one(600), true);
add("burgers", "Tikka Burger", "Chicken tikka burger.", one(280));
add("burgers", "Pizza Burger", "Pizza burger.", one(450));
add("burgers", "Mighty Burger", "Mighty burger.", one(600), true);

add("fries", "Regular Fries", "Regular fries.", one(199));
add("fries", "Loaded Fries", "Loaded fries.", one(349));
add("fries", "Pizza Fries", "Pizza fries.", one(349));
add("fries", "Crunchy Loaded Fries", "Crunchy loaded fries.", one(599));
add("fries", "Special Pizza Fries", "Special pizza fries.", one(599));

add("pasta", "Alfaredo Pasta", "Alfredo-style pasta.", one(450));
add("pasta", "Special Alfaredo Pasta", "Special alfredo pasta.", one(500));
add("pasta", "Oven Baked Pasta", "Oven baked pasta.", one(500));
add("pasta", "Special Oven Baked Pasta", "Special oven baked pasta.", one(500));

add("wings-snacks", "Wings", "Chicken wings.", one(650));
add("wings-snacks", "Hot Wings", "Hot chicken wings.", one(600));
add("wings-snacks", "Oven Baked", "Oven baked wings.", one(600));
add("wings-snacks", "Hot Short", "Hot short.", one(600));
add("wings-snacks", "Nuggets", "Chicken nuggets.", one(500));
add(
  "wings-snacks",
  "Loaded Fries Special",
  "Loaded fries from the wings section.",
  one(450),
);

add("rolls-shawarma", "Arabic Roll", "Arabic roll.", one(280));
add("rolls-shawarma", "Zinger Shawarma", "Zinger shawarma.", one(250));
add("rolls-shawarma", "Tikka Shawarma", "Tikka shawarma.", one(250));
add("rolls-shawarma", "Zinger Pratha Roll", "Zinger paratha roll.", one(350));
add("rolls-shawarma", "Chicken Pratha Roll", "Chicken paratha roll.", one(350));
add("rolls-shawarma", "Chicken Shawarma", "Chicken shawarma.", one(450));

add("broast", "Full Broast", "Full broast chicken.", one(1200), true);
add(
  "broast",
  "All Baked Chicken Broast",
  "All baked chicken broast.",
  one(1200),
);

add("sandwiches", "Grill Sandwich", "Grill sandwich.", one(500));
add("sandwiches", "Club Sandwich", "Club sandwich.", one(450));
add("sandwiches", "Panini Sandwich", "Panini sandwich.", one(600));

add(
  "chinese",
  "Chicken Manchurian with Rice",
  "Chicken manchurian served with rice.",
  one(599),
);
add(
  "chinese",
  "Chicken Chilli Dry with Rice",
  "Chicken chilli dry served with rice.",
  one(599),
);

add(
  "chowmein",
  "Special Chicken Chowmein",
  "Special chicken chowmein.",
  one(550),
);

add("nachos", "Crispy Loaded Nachos", "Crispy loaded nachos.", one(599));

const menu = {
  restaurant: {
    name: "Al-rehman Fast Food",
    tagline: "Maza he Maza",
    phone: "03013095109",
    alternatePhone: "",
    whatsapp: "923013095109",
    openingTime: "11:00 AM",
    closingTime: "12:00 AM",
    currency: "Rs",
    address: "",
    deliveryNote: "Call now for delivery",
    thankYouNote: "THANK YOU FOR CHOOSING AL-REHMAN FAST FOOD!",
  },
  promotions: [],
  notes: [
    "Fast-food flyer items only. Sweets, samosas and cakes will be added as separate categories later.",
    "Printed spellings kept where useful (Alfaredo, Peproni, Pratha, Sulet, Peti).",
    "Wings-section Loaded Fries is listed as Loaded Fries Special (Rs 450) so it is not mixed with Fries Loaded Fries (Rs 349).",
  ],
  locations: [
    {
      id: "50000000-0000-4000-8000-000000000000",
      name: "In Store (Walk-in)",
      deliveryCharge: 0,
    },
    {
      id: "50000000-0000-4000-8000-000000000001",
      name: "Local Delivery",
      deliveryCharge: 0,
    },
  ],
  categories,
  products,
};

writeFileSync(join(root, "shared", "menu.json"), `${JSON.stringify(menu, null, 2)}\n`);
writeFileSync(join(root, "website", "src", "data", "menu.json"), `${JSON.stringify(menu, null, 2)}\n`);
writeFileSync(join(root, "pos", "src", "data", "menu.json"), `${JSON.stringify(menu, null, 2)}\n`);
const shopSrc = join(root, "shared", "shop.json");
copyFileSync(shopSrc, join(root, "website", "src", "data", "shop.json"));
copyFileSync(shopSrc, join(root, "pos", "src", "data", "shop.json"));
copyFileSync(shopSrc, join(root, "admin", "src", "data", "shop.json"));
console.log(`Wrote shared/menu.json + website/pos copies (${products.length} products, ${categories.length} categories)`);
console.log("Copied shared/shop.json into website, pos, and admin.");
