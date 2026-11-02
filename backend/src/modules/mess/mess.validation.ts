import { z } from "zod";
import {
  COMPLAINT_KINDS,
  COMPLAINT_PRIORITY,
  COMPLAINT_STATUS,
  DEPOSIT_TX_TYPES,
  MESS_NOTICE_AUDIENCE,
  MESS_NOTICE_TYPES,
  MESS_PAYMENT_PURPOSE,
  MESS_STAFF_RESPONSIBILITIES,
  MESS_STATUS,
  ROOM_STATUS,
  SEAT_MANUAL_STATUS,
} from "./mess.constants";

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be yyyy-mm-dd");
const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Period must be yyyy-mm");
const money = z.number().finite().min(0).max(10_000_000);
const positiveMoney = z.number().finite().gt(0).max(10_000_000);
const text = (max = 500) => z.string().trim().max(max);
const reqText = (max = 500) => z.string().trim().min(1).max(max);
const attachment = z.object({ url: z.string().url().max(1000), publicId: z.string().max(300).optional(), resourceType: z.string().max(30).optional() });

const idParam = z.object({ id: objectId });
export const idParamSchema = z.object({ params: idParam });
const reasonBody = z.object({ reason: reqText(500) });
export const reasonSchema = z.object({ params: idParam, body: reasonBody });

const listQuery = z
  .object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().max(100).optional(),
    messId: objectId.optional(),
    roomId: objectId.optional(),
    status: z.string().max(200).optional(),
  })
  .passthrough();
export const listQuerySchema = z.object({ query: listQuery });

// -------------------- Setup --------------------

const messBody = z.object({
  name: reqText(150),
  address: text(500).optional(),
  contactNumber: text(30).optional(),
  openingDate: isoDate.optional().or(z.literal("")),
  notes: text(1000).optional(),
  status: z.enum(MESS_STATUS).optional(),
});
export const createMessSchema = z.object({ body: messBody });
export const updateMessSchema = z.object({ params: idParam, body: messBody.partial() });
export const setMessStaffSchema = z.object({
  params: idParam,
  body: z.object({ staff: z.array(z.object({ staffId: objectId, responsibility: z.enum(MESS_STAFF_RESPONSIBILITIES) })).max(100) }),
});

const roomBody = z.object({
  messId: objectId,
  name: reqText(60),
  floor: text(30).optional(),
  roomType: text(60).optional(),
  totalSeats: z.number().int().min(0).max(500),
  facilities: z.array(text(60)).max(30).optional(),
  status: z.enum(ROOM_STATUS).optional(),
  notes: text(500).optional(),
});
export const createRoomSchema = z.object({ body: roomBody });
export const updateRoomSchema = z.object({ params: idParam, body: roomBody.omit({ messId: true }).partial() });

export const createSeatsSchema = z.object({
  body: z
    .object({
      roomId: objectId,
      seatNumber: text(30).optional(),
      count: z.number().int().min(1).max(100).optional(),
      prefix: text(10).optional(),
      startNumber: z.number().int().min(0).max(10000).optional(),
      seatType: text(60).optional(),
      monthlyRent: money,
      availableFrom: isoDate.optional(),
      notes: text(500).optional(),
    })
    .refine((b) => !!b.seatNumber || !!b.count, { message: "seatNumber or count is required" }),
});
export const updateSeatSchema = z.object({
  params: idParam,
  body: z.object({
    seatNumber: reqText(30).optional(),
    seatType: text(60).optional(),
    monthlyRent: money.optional(),
    availableFrom: isoDate.optional().or(z.literal("")),
    notes: text(500).optional(),
    status: z.enum(SEAT_MANUAL_STATUS).optional(),
  }),
});

// -------------------- Members --------------------

const emergencyContact = z.object({ name: text(100).optional(), phone: text(30).optional(), relation: text(50).optional() });
const documents = z.array(z.object({ label: reqText(100), url: z.string().url().max(1000), publicId: z.string().max(300).optional() })).max(10);

export const createMembershipSchema = z.object({
  body: z.object({
    studentId: objectId,
    messId: objectId,
    seatId: objectId,
    joiningDate: isoDate,
    expectedLeavingDate: isoDate.optional(),
    monthlyRent: money.optional(),
    securityDeposit: money.optional(),
    discount: money.optional(),
    setupCharge: money.optional(),
    billingStartDate: isoDate.optional(),
    emergencyContact: emergencyContact.optional(),
    notes: text(1000).optional(),
    documents: documents.optional(),
    initialStatus: z.enum(["pending", "approved", "active"]).optional(),
    reservationId: objectId.optional(),
  }),
});
export const updateMembershipSchema = z.object({
  params: idParam,
  body: z.object({
    monthlyRent: money.optional(),
    discount: money.optional(),
    securityDeposit: money.optional(),
    setupCharge: money.optional(),
    expectedLeavingDate: isoDate.optional(),
    billingStartDate: isoDate.optional(),
    emergencyContact: emergencyContact.optional(),
    notes: text(1000).optional(),
    documents: documents.optional(),
  }),
});
export const approveMembershipSchema = z.object({ params: idParam, body: z.object({ seatId: objectId.optional(), note: text(500).optional() }) });
export const activateMembershipSchema = z.object({
  params: idParam,
  body: z.object({ joiningDate: isoDate.optional(), billingStartDate: isoDate.optional(), note: text(500).optional() }),
});
export const changeStatusSchema = z.object({
  params: idParam,
  body: z.object({ status: z.enum(["active", "on_leave", "notice_given"]), expectedLeavingDate: isoDate.optional(), note: text(500).optional() }),
});
export const transferSchema = z.object({
  params: idParam,
  body: z.object({ seatId: objectId, effectiveDate: isoDate.optional(), monthlyRent: money.optional(), reason: text(300).optional() }),
});

export const createReservationSchema = z.object({
  body: z.object({
    studentId: objectId,
    messId: objectId,
    seatId: objectId,
    reservationDate: isoDate.optional(),
    expiryDate: isoDate,
    advanceAmount: money.optional(),
    notes: text(500).optional(),
  }),
});

// -------------------- Finance --------------------

export const generateBillsSchema = z.object({
  body: z.object({
    period,
    messId: objectId.optional(),
    membershipIds: z.array(objectId).max(1000).optional(),
    additionalCharges: z.array(z.object({ label: reqText(100), amount: positiveMoney })).max(20).optional(),
    extraDiscount: money.optional(),
    dueDate: isoDate.optional(),
    notes: text(500).optional(),
  }),
});
export const generationPreviewSchema = z.object({ query: z.object({ period, messId: objectId.optional() }) });
export const adjustBillSchema = z.object({ params: idParam, body: z.object({ adjustment: money, reason: reqText(500) }) });

export const receivePaymentSchema = z.object({
  body: z
    .object({
      membershipId: objectId.optional(),
      reservationId: objectId.optional(),
      purpose: z.enum(MESS_PAYMENT_PURPOSE),
      amount: positiveMoney,
      method: reqText(60),
      date: isoDate.optional(),
      reference: text(100).optional(),
      note: text(500).optional(),
      idempotencyKey: z.string().min(8).max(100).optional(),
    })
    .refine((b) => !!b.membershipId !== !!b.reservationId, { message: "Provide exactly one of membershipId / reservationId" }),
});

export const createDepositTxSchema = z.object({
  params: idParam,
  body: z.object({
    type: z.enum(DEPOSIT_TX_TYPES),
    amount: positiveMoney,
    reason: text(500).optional(),
    method: text(60).optional(),
    reference: text(100).optional(),
    date: isoDate.optional(),
  }),
});
export const completeRefundSchema = z.object({ params: idParam, body: z.object({ method: reqText(60), date: isoDate.optional(), reference: text(100).optional() }) });

export const settlementPreviewSchema = z.object({ params: idParam, query: z.object({ damageCharges: z.string().regex(/^\d+(\.\d+)?$/).optional() }) });
export const createSettlementSchema = z.object({
  params: idParam,
  body: z.object({ leavingDate: isoDate, damageCharges: money.optional(), damageNote: text(500).optional(), notes: text(500).optional() }),
});
export const completeSettlementSchema = z.object({
  params: idParam,
  body: z.object({ refundMethod: text(60).optional(), refundDate: isoDate.optional(), refundReference: text(100).optional() }),
});

// -------------------- Operations --------------------

const expenseBody = z.object({
  messId: objectId,
  date: isoDate,
  category: reqText(100),
  description: text(1000).optional(),
  amount: positiveMoney,
  method: reqText(60),
  paidBy: text(100).optional(),
  vendor: text(150).optional(),
  invoiceNo: text(100).optional(),
  attachment: attachment.optional(),
  complaintId: objectId.optional(),
});
export const createExpenseSchema = z.object({ body: expenseBody });
export const updateExpenseSchema = z.object({ params: idParam, body: expenseBody.omit({ messId: true, complaintId: true }).partial() });
export const optionalReasonSchema = z.object({ params: idParam, body: z.object({ reason: text(500).optional() }) });

export const createComplaintSchema = z.object({
  body: z.object({
    kind: z.enum(COMPLAINT_KINDS),
    messId: objectId,
    roomId: objectId.optional(),
    category: reqText(100),
    title: reqText(200),
    description: text(2000).optional(),
    priority: z.enum(COMPLAINT_PRIORITY).optional(),
    attachment: attachment.optional(),
    assignedStaffId: objectId.optional(),
  }),
});
export const updateComplaintSchema = z.object({
  params: idParam,
  body: z.object({
    status: z.enum(COMPLAINT_STATUS).optional(),
    priority: z.enum(COMPLAINT_PRIORITY).optional(),
    assignedStaffId: objectId.nullable().optional(),
    note: text(1000).optional(),
  }),
});
export const portalComplaintSchema = z.object({
  body: z.object({
    category: reqText(100),
    title: reqText(200),
    description: text(2000).optional(),
    priority: z.enum(COMPLAINT_PRIORITY).optional(),
    attachment: attachment.optional(),
  }),
});

const noticeBody = z.object({
  messId: objectId,
  audience: z.enum(MESS_NOTICE_AUDIENCE),
  membershipId: objectId.optional(),
  type: z.enum(MESS_NOTICE_TYPES),
  title: reqText(200),
  body: reqText(3000),
  publishDate: isoDate.optional(),
  expiryDate: isoDate.optional(),
  sendSms: z.boolean().optional(),
});
export const createNoticeSchema = z.object({ body: noticeBody });
export const updateNoticeSchema = z.object({
  params: idParam,
  body: z.object({
    title: reqText(200).optional(),
    body: reqText(3000).optional(),
    type: z.enum(MESS_NOTICE_TYPES).optional(),
    publishDate: isoDate.optional(),
    expiryDate: isoDate.optional().or(z.literal("")),
    status: z.enum(["active", "archived"]).optional(),
  }),
});

// -------------------- Settings --------------------

const list = z.array(reqText(100)).max(100);
export const updateMessSettingsSchema = z.object({
  body: z.object({
    defaultMessId: objectId.optional(),
    billingDay: z.number().int().min(1).max(28).optional(),
    dueDay: z.number().int().min(1).max(28).optional(),
    gracePeriodDays: z.number().int().min(0).max(60).optional(),
    defaultRent: money.optional(),
    defaultDeposit: money.optional(),
    receiptPrefix: z.string().trim().regex(/^[A-Za-z0-9]{1,10}$/, "Letters/digits only, max 10").optional(),
    billPrefix: z.string().trim().regex(/^[A-Za-z0-9]{1,10}$/, "Letters/digits only, max 10").optional(),
    lateFeeEnabled: z.boolean().optional(),
    lateFeeAmount: money.optional(),
    prorationEnabled: z.boolean().optional(),
    discountApprovalRequired: z.boolean().optional(),
    refundApprovalRequired: z.boolean().optional(),
    expenseApprovalRequired: z.boolean().optional(),
    paymentMethods: z.array(reqText(60)).max(30).optional(),
    paymentSmsEnabled: z.boolean().optional(),
    roomTypes: list.optional(),
    seatTypes: list.optional(),
    complaintCategories: list.min(1).optional(),
    maintenanceCategories: list.min(1).optional(),
    expenseCategories: list.min(1).optional(),
  }),
});
