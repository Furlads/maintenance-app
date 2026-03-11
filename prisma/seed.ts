import prisma from "./prisma";

async function main() {
  console.log("🌱 Seeding started...");

  // Show what DB file Prisma is actually using
  const dbInfo = await prisma.$queryRawUnsafe<any[]>(`PRAGMA database_list;`);
  console.log("📌 DB Info:", dbInfo);

  // Wipe + recreate
  const staffDel = await prisma.staff.deleteMany();
  const compDel = await prisma.company.deleteMany();
  console.log("🧹 Deleted staff:", staffDel.count);
  console.log("🧹 Deleted companies:", compDel.count);

  const company = await prisma.company.create({
    data: { name: "Three Counties Property Care" },
  });
  console.log("🏢 Created company:", company);

  const createdStaff = await prisma.staff.createMany({
    data: [
      { name: "Trev", role: "admin", companyId: company.id, active: true },
      { name: "Kelly", role: "manager", companyId: company.id, active: true },
      { name: "Stephen", role: "worker", companyId: company.id, active: true },
      { name: "Jacob", role: "worker", companyId: company.id, active: true }
    ],
  });
  console.log("👷 Created staff count:", createdStaff.count);

  const companyCount = await prisma.company.count();
  const staffCount = await prisma.staff.count();
  console.log("✅ Final counts => companies:", companyCount, "staff:", staffCount);

  console.log("🌱 Seeding finished.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });