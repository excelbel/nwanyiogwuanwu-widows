// normalize-images-and-update-posts.js
// This script cleans image filenames, updates posts.json, and ensures your images folder exists

const fs = require("fs");
const path = require("path");
const { createCanvas } = require("canvas"); // used to generate a placeholder image

// File paths
const POSTS_FILE = path.join(__dirname, "posts.json");
const IMAGES_DIR = path.join(__dirname, "images");

// ✅ Ensure the images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  console.log("⚠️  Images folder not found. Creating one for you...");
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  console.log(`✅ Created folder at: ${IMAGES_DIR}`);
}

// ✅ Create a placeholder image if missing
const PLACEHOLDER_PATH = path.join(IMAGES_DIR, "placeholder.jpg");
if (!fs.existsSync(PLACEHOLDER_PATH)) {
  console.log("🖼️  Creating placeholder.jpg...");
  const canvas = createCanvas(600, 400);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#e0e0e0";
  ctx.fillRect(0, 0, 600, 400);
  ctx.fillStyle = "#666";
  ctx.font = "bold 30px Arial";
  ctx.textAlign = "center";
  ctx.fillText("No Image Available", 300, 200);
  const buffer = canvas.toBuffer("image/jpeg");
  fs.writeFileSync(PLACEHOLDER_PATH, buffer);
  console.log("✅ placeholder.jpg created.");
}

// ✅ Check if posts.json exists
if (!fs.existsSync(POSTS_FILE)) {
  console.error(`❌ posts.json not found at ${POSTS_FILE}`);
  process.exit(1);
}

// ✅ Read and parse posts.json
console.log("🔄 Reading posts.json...");
const posts = JSON.parse(fs.readFileSync(POSTS_FILE, "utf-8"));

// Helper function to clean filenames
function slugify(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ✅ Read all image files in /images
const files = fs.readdirSync(IMAGES_DIR);
console.log(`📸 Found ${files.length} image files in /images`);

// ✅ Process and update each post
posts.forEach((post, i) => {
  const expectedName = `blog${i + 1}.jpg`;
  const postSlug = slugify(post.slug || post.title || `blog-${i + 1}`);

  const match = files.find(
    (f) =>
      f.toLowerCase().includes(postSlug) ||
      f.toLowerCase().includes(`blog${i + 1}`)
  );

  if (match) {
    const oldPath = path.join(IMAGES_DIR, match);
    const newPath = path.join(IMAGES_DIR, expectedName);

    if (match !== expectedName) {
      fs.renameSync(oldPath, newPath);
      console.log(`✅ Renamed ${match} → ${expectedName}`);
    }

    post.image = `images/${expectedName}`;
  } else {
    console.warn(`⚠️  No image found for "${post.title}". Using placeholder.`);
    post.image = "images/placeholder.jpg";
  }
});

// ✅ Save the updated posts.json
fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2), "utf-8");
console.log("✅ posts.json updated successfully!");
