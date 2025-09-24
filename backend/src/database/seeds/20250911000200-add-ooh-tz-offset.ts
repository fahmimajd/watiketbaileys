import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const now = new Date();
    await queryInterface.bulkInsert(
      "Settings",
      [
        { key: "businessTzOffsetMin", value: "0", createdAt: now, updatedAt: now }
      ],
      {}
    );
  },
  down: async (queryInterface: QueryInterface) => {
    await queryInterface.bulkDelete("Settings", { key: ["businessTzOffsetMin"] });
  }
};

