import bcrypt from "bcryptjs";

async function run() {
  const password = "Jacob2026!";
  const hash = await bcrypt.hash(password, 10);
  console.log(hash);
}

run();