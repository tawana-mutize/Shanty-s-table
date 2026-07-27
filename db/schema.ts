import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  collectionTime: text("collection_time").notNull(),
  notes: text("notes").notNull().default(""),
  items: text("items").notNull(),
  total: integer("total").notNull(),
  status: text("status").notNull().default("new"),
  createdAt: text("created_at").notNull(),
});
