// In this file is a mock implementation of the Google Sheets API.  It is used
// to test the Google Sheets integration, and it keeps track of a single
// spreadsheet with many sheets. It aims to be a faithful recreation of the
// Google Sheets API, but it is not a perfect recreation. Some fields are
// missing if they aren't relevant to our use of the API. It's possible that
// this will cause problems for future feature development, but the original
// development of these tests involved hitting Google's APIs directly and
// examining the responses. If we couldn't find a good example of something in
// use, it wasn't included.
import { Datasource } from "@budibase/types"
import nock from "nock"
import { GoogleSheetsConfig } from "../../googlesheets"

// https://protobuf.dev/reference/protobuf/google.protobuf/#value
type Value = string | number | boolean | null

// https://developers.google.com/sheets/api/reference/rest/v4/Dimension
type Dimension = "ROWS" | "COLUMNS"

interface Range {
  row: number
  column: number
}

// https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/sheets#DimensionProperties
interface DimensionProperties {
  hiddenByFilter: boolean
  hiddenByUser: boolean
  pixelSize: number
  // developerMetadata: DeveloperMetadata[]
  // dataSourceColumnReference: DataSourceColumnReference
}

// https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values#ValueRange
interface ValueRange {
  range: string
  majorDimension: Dimension
  values: Value[][]
}

// https://developers.google.com/sheets/api/reference/rest/v4/UpdateValuesResponse
interface UpdateValuesResponse {
  spreadsheetId: string
  updatedRange: string
  updatedRows: number
  updatedColumns: number
  updatedCells: number
  updatedData: ValueRange
}

// https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/response#AddSheetResponse
interface AddSheetResponse {
  properties: SheetProperties
}

interface Response {
  addSheet?: AddSheetResponse
}

// https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/response
interface BatchUpdateResponse {
  spreadsheetId: string
  replies: Response[]
  updatedSpreadsheet: Spreadsheet
}

// https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/sheets#GridProperties
interface GridProperties {
  rowCount: number
  columnCount: number
  frozenRowCount: number
  frozenColumnCount: number
  hideGridlines: boolean
  rowGroupControlAfter: boolean
  columnGroupControlAfter: boolean
}

// https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/sheets#SheetProperties
interface SheetProperties {
  sheetId: number
  title: string
  gridProperties: GridProperties
}

// https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request#AddSheetRequest
interface AddSheetRequest {
  properties: SheetProperties
}

interface Request {
  addSheet?: AddSheetRequest
}

// https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/request
interface BatchUpdateRequest {
  requests: Request[]
  includeSpreadsheetInResponse: boolean
  responseRanges: string[]
  responseIncludeGridData: boolean
}

// https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/other#ErrorValue
interface ErrorValue {
  type: string
  message: string
}

// https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/other#ExtendedValue
interface ExtendedValue {
  stringValue?: string
  numberValue?: number
  boolValue?: boolean
  formulaValue?: string
  errorValue?: ErrorValue
}

// https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/cells#CellData
interface CellData {
  userEnteredValue: ExtendedValue
}

// https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/sheets#RowData
interface RowData {
  values: CellData[]
}

// https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/sheets#GridData
interface GridData {
  startRow: number
  startColumn: number
  rowData: RowData[]
  rowMetadata: DimensionProperties[]
  columnMetadata: DimensionProperties[]
}

// https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets/sheets#Sheet
interface Sheet {
  properties: SheetProperties
  data: GridData[]
}

// https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets#SpreadsheetProperties
interface SpreadsheetProperties {
  title: string
}

// https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets#Spreadsheet
interface Spreadsheet {
  properties: SpreadsheetProperties
  spreadsheetId: string
  sheets: Sheet[]
}

// https://developers.google.com/sheets/api/reference/rest/v4/ValueInputOption
type ValueInputOption =
  | "USER_ENTERED"
  | "RAW"
  | "INPUT_VALUE_OPTION_UNSPECIFIED"

// https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/append#InsertDataOption
type InsertDataOption = "OVERWRITE" | "INSERT_ROWS"

// https://developers.google.com/sheets/api/reference/rest/v4/ValueRenderOption
type ValueRenderOption = "FORMATTED_VALUE" | "UNFORMATTED_VALUE" | "FORMULA"

// https://developers.google.com/sheets/api/reference/rest/v4/DateTimeRenderOption
type DateTimeRenderOption = "SERIAL_NUMBER" | "FORMATTED_STRING"

// https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/append#query-parameters
interface AppendParams {
  valueInputOption?: ValueInputOption
  insertDataOption?: InsertDataOption
  includeValuesInResponse?: boolean
  responseValueRenderOption?: ValueRenderOption
  responseDateTimeRenderOption?: DateTimeRenderOption
}

// https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/batchGet#query-parameters
interface BatchGetParams {
  ranges: string[]
  majorDimension?: Dimension
  valueRenderOption?: ValueRenderOption
  dateTimeRenderOption?: DateTimeRenderOption
}

// https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/batchGet#response-body
interface BatchGetResponse {
  spreadsheetId: string
  valueRanges: ValueRange[]
}

interface AppendRequest {
  range: string
  params: AppendParams
  body: ValueRange
}

// https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/append#response-body
interface AppendResponse {
  spreadsheetId: string
  tableRange: string
  updates: UpdateValuesResponse
}

export class GoogleSheetsMock {
  private config: GoogleSheetsConfig
  private spreadsheet: Spreadsheet

  static forDatasource(datasource: Datasource): GoogleSheetsMock {
    return new GoogleSheetsMock(datasource.config as GoogleSheetsConfig)
  }

  private constructor(config: GoogleSheetsConfig) {
    this.config = config
    this.spreadsheet = {
      properties: {
        title: "Test Spreadsheet",
      },
      spreadsheetId: config.spreadsheetId,
      sheets: [],
    }

    this.mockAuth()
    this.mockAPI()
  }

  private route(
    method: "get" | "put" | "post",
    path: string | RegExp,
    handler: (uri: string, request: nock.Body) => nock.Body
  ): nock.Scope {
    const headers = { reqheaders: { authorization: "Bearer test" } }
    const scope = nock("https://sheets.googleapis.com/", headers)
    return scope[method](path).reply(200, handler).persist()
  }

  private get(
    path: string | RegExp,
    handler: (uri: string, request: nock.Body) => nock.Body
  ): nock.Scope {
    return this.route("get", path, handler)
  }

  private put(
    path: string | RegExp,
    handler: (uri: string, request: nock.Body) => nock.Body
  ): nock.Scope {
    return this.route("put", path, handler)
  }

  private post(
    path: string | RegExp,
    handler: (uri: string, request: nock.Body) => nock.Body
  ): nock.Scope {
    return this.route("post", path, handler)
  }

  private mockAuth() {
    nock("https://www.googleapis.com/")
      .post("/oauth2/v4/token")
      .reply(200, {
        grant_type: "client_credentials",
        client_id: "your-client-id",
        client_secret: "your-client-secret",
      })
      .persist()

    nock("https://oauth2.googleapis.com/")
      .post("/token", {
        client_id: "test",
        client_secret: "test",
        grant_type: "refresh_token",
        refresh_token: "refreshToken",
      })
      .reply(200, {
        access_token: "test",
        expires_in: 3600,
        token_type: "Bearer",
        scopes: "https://www.googleapis.com/auth/spreadsheets",
      })
      .persist()
  }

  private mockAPI() {
    const spreadsheetId = this.config.spreadsheetId

    this.get(`/v4/spreadsheets/${spreadsheetId}/`, () =>
      this.handleGetSpreadsheet()
    )

    // https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/batchUpdate
    this.post(
      `/v4/spreadsheets/${spreadsheetId}/:batchUpdate`,
      (_uri, request) => this.handleBatchUpdate(request as BatchUpdateRequest)
    )

    // https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/update
    this.put(
      new RegExp(`/v4/spreadsheets/${spreadsheetId}/values/.*`),
      (_uri, request) => this.handleValueUpdate(request as ValueRange)
    )

    // https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/batchGet
    this.get(
      new RegExp(`/v4/spreadsheets/${spreadsheetId}/values:batchGet.*`),
      uri => {
        const url = new URL(uri, "https://sheets.googleapis.com/")
        const params: BatchGetParams = {
          ranges: url.searchParams.getAll("ranges"),
          majorDimension:
            (url.searchParams.get("majorDimension") as Dimension) || "ROWS",
          valueRenderOption:
            (url.searchParams.get("valueRenderOption") as ValueRenderOption) ||
            undefined,
          dateTimeRenderOption:
            (url.searchParams.get(
              "dateTimeRenderOption"
            ) as DateTimeRenderOption) || undefined,
        }
        return this.handleBatchGet(params as unknown as BatchGetParams)
      }
    )

    // https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/get
    this.get(new RegExp(`/v4/spreadsheets/${spreadsheetId}/values/.*`), uri => {
      const range = uri.split("/").pop()
      if (!range) {
        throw new Error("No range provided")
      }
      return this.getValueRange(decodeURIComponent(range))
    })

    // https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/append
    this.post(
      new RegExp(`/v4/spreadsheets/${spreadsheetId}/values/.*:append`),
      (_uri, request) => {
        const url = new URL(_uri, "https://sheets.googleapis.com/")
        const params: Record<string, any> = Object.fromEntries(
          url.searchParams.entries()
        )

        if (params.includeValuesInResponse === "true") {
          params.includeValuesInResponse = true
        } else {
          params.includeValuesInResponse = false
        }

        let range = url.pathname.split("/").pop()
        if (!range) {
          throw new Error("No range provided")
        }

        if (range.endsWith(":append")) {
          range = range.slice(0, -7)
        }

        range = decodeURIComponent(range)

        return this.handleValueAppend({
          range,
          params,
          body: request as ValueRange,
        })
      }
    )
  }

  private handleValueAppend(request: AppendRequest): AppendResponse {
    const { range, params, body } = request
    const { sheet, bottomRight } = this.parseA1Notation(range)

    const newRows = body.values.map(v => this.valuesToRowData(v))
    const toDelete =
      params.insertDataOption === "INSERT_ROWS" ? newRows.length : 0
    sheet.data[0].rowData.splice(bottomRight.row + 1, toDelete, ...newRows)
    sheet.data[0].rowMetadata.splice(bottomRight.row + 1, toDelete, {
      hiddenByUser: false,
      hiddenByFilter: false,
      pixelSize: 100,
    })

    const updatedRange = this.createA1FromRanges(
      sheet,
      {
        row: bottomRight.row + 1,
        column: 0,
      },
      {
        row: bottomRight.row + newRows.length,
        column: 0,
      }
    )

    return {
      spreadsheetId: this.spreadsheet.spreadsheetId,
      tableRange: range,
      updates: {
        spreadsheetId: this.spreadsheet.spreadsheetId,
        updatedRange,
        updatedRows: body.values.length,
        updatedColumns: body.values[0].length,
        updatedCells: body.values.length * body.values[0].length,
        updatedData: body,
      },
    }
  }

  private handleBatchGet(params: BatchGetParams): BatchGetResponse {
    const { ranges, majorDimension } = params

    if (majorDimension && majorDimension !== "ROWS") {
      throw new Error("Only row-major updates are supported")
    }

    return {
      spreadsheetId: this.spreadsheet.spreadsheetId,
      valueRanges: ranges.map(range => this.getValueRange(range)),
    }
  }

  private handleBatchUpdate(
    batchUpdateRequest: BatchUpdateRequest
  ): BatchUpdateResponse {
    const replies: Response[] = []

    for (const request of batchUpdateRequest.requests) {
      if (request.addSheet) {
        const response = this.handleAddSheet(request.addSheet)
        replies.push({ addSheet: response })
      }
    }

    return {
      spreadsheetId: this.spreadsheet.spreadsheetId,
      replies,
      updatedSpreadsheet: this.spreadsheet,
    }
  }

  private handleAddSheet(request: AddSheetRequest): AddSheetResponse {
    const properties: SheetProperties = {
      title: request.properties.title,
      sheetId: this.spreadsheet.sheets.length,
      gridProperties: {
        rowCount: 100,
        columnCount: 26,
        frozenRowCount: 0,
        frozenColumnCount: 0,
        hideGridlines: false,
        rowGroupControlAfter: false,
        columnGroupControlAfter: false,
      },
    }

    this.spreadsheet.sheets.push({
      properties,
      data: [this.createEmptyGrid(100, 26)],
    })

    return { properties }
  }

  private handleGetSpreadsheet(): Spreadsheet {
    return this.spreadsheet
  }

  private handleValueUpdate(valueRange: ValueRange): UpdateValuesResponse {
    this.iterateCells(valueRange, (cell, value) => {
      cell.userEnteredValue = this.createValue(value)
    })

    const response: UpdateValuesResponse = {
      spreadsheetId: this.spreadsheet.spreadsheetId,
      updatedRange: valueRange.range,
      updatedRows: valueRange.values.length,
      updatedColumns: valueRange.values[0].length,
      updatedCells: valueRange.values.length * valueRange.values[0].length,
      updatedData: valueRange,
    }
    return response
  }

  private iterateCells(
    valueRange: ValueRange,
    cb: (cell: CellData, value: Value) => void
  ) {
    if (valueRange.majorDimension !== "ROWS") {
      throw new Error("Only row-major updates are supported")
    }

    const { sheet, topLeft, bottomRight } = this.parseA1Notation(
      valueRange.range
    )
    for (let row = topLeft.row; row <= bottomRight.row; row++) {
      for (let col = topLeft.column; col <= bottomRight.column; col++) {
        const cell = this.getCellNumericIndexes(sheet, row, col)
        if (!cell) {
          throw new Error("Cell not found")
        }
        const value = valueRange.values[row - topLeft.row][col - topLeft.column]
        cb(cell, value)
      }
    }
  }

  private getValueRange(range: string): ValueRange {
    const { sheet, topLeft, bottomRight } = this.parseA1Notation(range)
    const valueRange: ValueRange = {
      range,
      majorDimension: "ROWS",
      values: [],
    }

    for (let row = topLeft.row; row <= bottomRight.row; row++) {
      const values: Value[] = []
      for (let col = topLeft.column; col <= bottomRight.column; col++) {
        const cell = this.getCellNumericIndexes(sheet, row, col)
        if (!cell) {
          throw new Error("Cell not found")
        }
        values.push(this.unwrapValue(cell.userEnteredValue))
      }
      valueRange.values.push(values)
    }

    return valueRange
  }

  private valuesToRowData(values: Value[]): RowData {
    return {
      values: values.map(v => {
        return { userEnteredValue: this.createValue(v) }
      }),
    }
  }

  private unwrapValue(from: ExtendedValue): Value {
    if (from.stringValue !== undefined) {
      return from.stringValue
    } else if (from.numberValue !== undefined) {
      return from.numberValue
    } else if (from.boolValue !== undefined) {
      return from.boolValue
    } else if (from.formulaValue !== undefined) {
      return from.formulaValue
    } else {
      return null
    }
  }

  private createValue(from: Value): ExtendedValue {
    if (from == null) {
      return {}
    } else if (typeof from === "string") {
      return {
        stringValue: from,
      }
    } else if (typeof from === "number") {
      return {
        numberValue: from,
      }
    } else if (typeof from === "boolean") {
      return {
        boolValue: from,
      }
    } else {
      throw new Error("Unsupported value type")
    }
  }

  private createEmptyGrid(numRows: number, numCols: number): GridData {
    const rowData: RowData[] = []
    for (let row = 0; row < numRows; row++) {
      const cells: CellData[] = []
      for (let col = 0; col < numCols; col++) {
        cells.push({ userEnteredValue: this.createValue(null) })
      }
      rowData.push({ values: cells })
    }
    const rowMetadata: DimensionProperties[] = []
    for (let row = 0; row < numRows; row++) {
      rowMetadata.push({
        hiddenByFilter: false,
        hiddenByUser: false,
        pixelSize: 100,
      })
    }
    const columnMetadata: DimensionProperties[] = []
    for (let col = 0; col < numCols; col++) {
      columnMetadata.push({
        hiddenByFilter: false,
        hiddenByUser: false,
        pixelSize: 100,
      })
    }

    return {
      startRow: 0,
      startColumn: 0,
      rowData,
      rowMetadata,
      columnMetadata,
    }
  }

  private cellData(cell: string): CellData | undefined {
    const {
      sheet,
      topLeft: { row, column },
    } = this.parseA1Notation(cell)
    return this.getCellNumericIndexes(sheet, row, column)
  }

  cell(cell: string): Value | undefined {
    const cellData = this.cellData(cell)
    if (!cellData) {
      return undefined
    }
    return this.unwrapValue(cellData.userEnteredValue)
  }

  private getCellNumericIndexes(
    sheet: Sheet,
    row: number,
    column: number
  ): CellData | undefined {
    const data = sheet.data[0]
    const rowData = data.rowData[row]
    if (!rowData) {
      return undefined
    }
    const cell = rowData.values[column]
    if (!cell) {
      return undefined
    }
    return cell
  }

  // https://developers.google.com/sheets/api/guides/concepts#cell
  //
  // Examples from
  //   https://code.luasoftware.com/tutorials/google-sheets-api/google-sheets-api-range-parameter-a1-notation
  //
  //   "Sheet1!A1"     -> First cell on Row 1 Col 1
  //   "Sheet1!A1:C1"  -> Col 1-3 (A, B, C) on Row 1 = A1, B1, C1
  //   "A1"            -> First visible sheet (if sheet name is ommitted)
  //   "'My Sheet'!A1" -> If sheet name which contain space or start with a bracket.
  //   "Sheet1"        -> All cells in Sheet1.
  //   "Sheet1!A:A"    -> All cells on Col 1.
  //   "Sheet1!A:B"    -> All cells on Col 1 and 2.
  //   "Sheet1!1:1"    -> All cells on Row 1.
  //   "Sheet1!1:2"    -> All cells on Row 1 and 2.
  //
  // How that translates to our code below, omitting the `sheet` property:
  //
  //   "Sheet1!A1"     -> { topLeft: { row: 0, column: 0 }, bottomRight: { row: 0, column: 0 } }
  //   "Sheet1!A1:C1"  -> { topLeft: { row: 0, column: 0 }, bottomRight: { row: 0, column: 2 } }
  //   "A1"            -> { topLeft: { row: 0, column: 0 }, bottomRight: { row: 0, column: 0 } }
  //   "Sheet1"        -> { topLeft: { row: 0, column: 0 }, bottomRight: { row: 100, column: 25 } }
  //                    -> This is because we default to having a 100x26 grid.
  //   "Sheet1!A:A"    -> { topLeft: { row: 0, column: 0 }, bottomRight: { row: 99, column: 0 } }
  //   "Sheet1!A:B"    -> { topLeft: { row: 0, column: 0 }, bottomRight: { row: 99, column: 1 } }
  //   "Sheet1!1:1"    -> { topLeft: { row: 0, column: 0 }, bottomRight: { row: 0, column: 25 } }
  //   "Sheet1!1:2"    -> { topLeft: { row: 0, column: 0 }, bottomRight: { row: 1, column: 25 } }
  private parseA1Notation(range: string): {
    sheet: Sheet
    topLeft: Range
    bottomRight: Range
  } {
    let sheet: Sheet
    let rest: string
    if (!range.includes("!")) {
      sheet = this.spreadsheet.sheets[0]
      rest = range
    } else {
      let sheetName = range.split("!")[0]
      if (sheetName.startsWith("'") && sheetName.endsWith("'")) {
        sheetName = sheetName.slice(1, -1)
      }
      const foundSheet = this.getSheetByName(sheetName)
      if (!foundSheet) {
        throw new Error(`Sheet ${sheetName} not found`)
      }
      sheet = foundSheet
      rest = range.split("!")[1]
    }

    const [topLeft, bottomRight] = rest.split(":")

    const parsedTopLeft = topLeft ? this.parseCell(topLeft) : undefined
    let parsedBottomRight = bottomRight
      ? this.parseCell(bottomRight)
      : undefined

    if (!parsedTopLeft && !parsedBottomRight) {
      throw new Error("No range provided")
    }

    if (!parsedTopLeft) {
      throw new Error("No top left cell provided")
    }

    if (!parsedBottomRight) {
      parsedBottomRight = parsedTopLeft
    }

    if (parsedTopLeft && parsedTopLeft.row === undefined) {
      parsedTopLeft.row = 0
    }
    if (parsedTopLeft && parsedTopLeft.column === undefined) {
      parsedTopLeft.column = 0
    }
    if (parsedBottomRight && parsedBottomRight.row === undefined) {
      parsedBottomRight.row = sheet.properties.gridProperties.rowCount - 1
    }
    if (parsedBottomRight && parsedBottomRight.column === undefined) {
      parsedBottomRight.column = sheet.properties.gridProperties.columnCount - 1
    }

    return {
      sheet,
      topLeft: parsedTopLeft as Range,
      bottomRight: parsedBottomRight as Range,
    }
  }

  private createA1FromRanges(sheet: Sheet, topLeft: Range, bottomRight: Range) {
    let title = sheet.properties.title
    if (title.includes(" ")) {
      title = `'${title}'`
    }
    const topLeftLetter = this.numberToLetter(topLeft.column)
    const bottomRightLetter = this.numberToLetter(bottomRight.column)
    const topLeftRow = topLeft.row + 1
    const bottomRightRow = bottomRight.row + 1
    return `${title}!${topLeftLetter}${topLeftRow}:${bottomRightLetter}${bottomRightRow}`
  }

  /**
   * Parses a cell reference into a row and column.
   * @param cell a string of the form A1, B2, etc.
   * @returns
   */
  private parseCell(cell: string): Partial<Range> {
    const firstChar = cell.slice(0, 1)
    if (this.isInteger(firstChar)) {
      return { row: parseInt(cell) - 1 }
    }
    const column = this.letterToNumber(firstChar)
    if (cell.length === 1) {
      return { column }
    }
    const number = cell.slice(1)
    return { row: parseInt(number) - 1, column }
  }

  private isInteger(value: string): boolean {
    return !isNaN(parseInt(value))
  }

  private letterToNumber(letter: string): number {
    return letter.charCodeAt(0) - 65
  }

  private numberToLetter(number: number): string {
    return String.fromCharCode(number + 65)
  }

  private getSheetByName(name: string): Sheet | undefined {
    return this.spreadsheet.sheets.find(
      sheet => sheet.properties.title === name
    )
  }
}
