import { Product, Purchase, Sale, Expense, Seller, CapitalSummary, CapitalApport } from "../types";

export const initialProducts: Product[] = [];
export const initialSellers: Seller[] = [];
export const initialPurchases: Purchase[] = [];
export const initialSales: Sale[] = [];
export const initialExpenses: Expense[] = [];
export const initialApports: CapitalApport[] = [];

export const initialCapital: CapitalSummary = {
  capitalInitial: 0,
  apportsTotal: 0,
  ventesTotalEncaisse: 0,
  achatsTotal: 0,
  depensesVendeursTotal: 0,
  tresorerieGlobaleActuelle: 0,
  seuilAlerteTresorerie: 50000,
};
