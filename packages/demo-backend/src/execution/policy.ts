import { arr, num, obj, Row } from "@neurofence/contracts/types";

export function published(row: Row, index: number): Row {
  if (
    row.status === "Canary" &&
    index % 100 >= num(row.canary, 10) &&
    arr(row.history).length
  )
    return {
      ...row,
      ...obj(arr(row.history).at(-1)),
      status: "Active",
    } as Row;
  return row;
}
