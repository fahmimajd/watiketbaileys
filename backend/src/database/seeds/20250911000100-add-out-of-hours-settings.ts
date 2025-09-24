import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const now = new Date();
    await queryInterface.bulkInsert(
      "Settings",
      [
        { key: "outOfHours", value: "disabled", createdAt: now, updatedAt: now },
        {
          key: "outOfHoursMessage",
          value: "Kami di luar jam kerja. Kami akan membalas di jam operasional berikutnya.",
          createdAt: now,
          updatedAt: now
        },
        { key: "businessHoursStart", value: "08:00", createdAt: now, updatedAt: now },
        { key: "businessHoursEnd", value: "17:00", createdAt: now, updatedAt: now },
        { key: "businessDays", value: "1,2,3,4,5", createdAt: now, updatedAt: now }
      ],
      {}
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.bulkDelete("Settings", {
      key: [
        "outOfHours",
        "outOfHoursMessage",
        "businessHoursStart",
        "businessHoursEnd",
        "businessDays"
      ]
    });
  }
};

