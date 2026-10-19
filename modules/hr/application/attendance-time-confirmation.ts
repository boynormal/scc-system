export type StoredTimeConfirmation = {
  confirmedIn: Date
  confirmedOut: Date
  sourceFirstIn: Date | null
  sourceLastOut: Date | null
}

export type EffectiveDayTimes = {
  firstIn: Date | null
  lastOut: Date | null
  confirmed: boolean
  scanChanged: boolean
}

function sameInstant(left: Date | null, right: Date | null): boolean {
  if (left == null || right == null) return left == null && right == null
  return left.getTime() === right.getTime()
}

/** ไม่มีแถวยืนยันใช้เวลาสแกน มีแถวยืนยันใช้เวลาของ HR แม้สแกนจะเปลี่ยนภายหลัง */
export function effectiveDayTimes(
  scanFirstIn: Date | null,
  scanLastOut: Date | null,
  confirmation: StoredTimeConfirmation | null
): EffectiveDayTimes {
  if (!confirmation) {
    return { firstIn: scanFirstIn, lastOut: scanLastOut, confirmed: false, scanChanged: false }
  }
  return {
    firstIn: confirmation.confirmedIn,
    lastOut: confirmation.confirmedOut,
    confirmed: true,
    scanChanged:
      !sameInstant(confirmation.sourceFirstIn, scanFirstIn) ||
      !sameInstant(confirmation.sourceLastOut, scanLastOut),
  }
}
