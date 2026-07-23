import { prisma } from "@/shared/db"
import {
  createNotification as createNotificationWithDb,
  createNotifications as createNotificationsWithDb,
  generateLowStockNotifications as generateLowStockNotificationsWithDb,
  generateOverdueNotifications as generateOverdueNotificationsWithDb,
  notifyWOAssigned as notifyWOAssignedWithDb,
  notifyWOCompleted as notifyWOCompletedWithDb,
  type CreateNotificationInput,
} from "@/modules/notifications"

export type { CreateNotificationInput, NotificationType } from "@/modules/notifications"

export async function createNotification(input: CreateNotificationInput) {
  return createNotificationWithDb(prisma, input)
}

export async function createNotifications(inputs: CreateNotificationInput[]) {
  return createNotificationsWithDb(prisma, inputs)
}

export async function notifyWOAssigned(workOrderId: string, assigneeId: string, woTitle: string, woNumber: string) {
  return notifyWOAssignedWithDb(prisma, workOrderId, assigneeId, woTitle, woNumber)
}

export async function notifyWOCompleted(workOrderId: string, createdById: string, woTitle: string, woNumber: string) {
  return notifyWOCompletedWithDb(prisma, workOrderId, createdById, woTitle, woNumber)
}

export async function generateOverdueNotifications(companyId: string) {
  return generateOverdueNotificationsWithDb(prisma, companyId)
}

export async function generateLowStockNotifications(companyId: string) {
  return generateLowStockNotificationsWithDb(prisma, companyId)
}
