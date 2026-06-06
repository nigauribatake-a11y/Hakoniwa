import type {
  Cell,
  CommandEvaluation,
  CommandKind,
  CommandPlan,
  Island,
  LogsResponse,
  StateResponse,
  TurnResult
} from "./types.js";

const commandLabels: Record<CommandKind, string> = {
  doNothing: "何もしない",
  prepare: "整地",
  reclaim: "埋め立て",
  destroy: "掘削",
  sellTrees: "伐採",
  plant: "植林",
  buildFarm: "農場整備",
  buildFactory: "工場建設",
  developMine: "採掘場整備",
  buildMissileBase: "ミサイル基地",
  buildMonument: "記念碑"
};

const terrainLabels: Record<string, string> = {
  sea: "海",
  waste: "荒地",
  plains: "平地",
  town: "町",
  forest: "森",
  farm: "農場",
  factory: "工場",
  mountain: "山",
  missileBase: "基地",
  defence: "防衛",
  monument: "碑"
};

const terrainGlyphs: Record<string, string> = {
  sea: "~",
  waste: ".",
  plains: "",
  town: "町",
  forest: "森",
  farm: "農",
  factory: "工",
  mountain: "山",
  missileBase: "基",
  defence: "防",
  monument: "碑"
};

const commandKinds = Object.keys(commandLabels) as CommandKind[];
const defaultApiBase = localStorage.getItem("hakoniwa.apiBase") ?? "http://127.0.0.1:3000";

let loaded: StateResponse | undefined;
let selectedIslandId = "1";
let selectedCell = { x: 0, y: 0 };
let selectedCommand: CommandKind = "plant";

const apiBaseInput = byId<HTMLInputElement>("apiBase");
const connectionStatus = byId("connectionStatus");
const islandSelect = byId<HTMLSelectElement>("islandSelect");
const stats = byId("stats");
const map = byId("map");
const cellDetails = byId("cellDetails");
const commandSelect = byId<HTMLSelectElement>("commandSelect");
const queuePosition = byId<HTMLInputElement>("queuePosition");
const commandCost = byId("commandCost");
const queue = byId("queue");
const logs = byId("logs");
const refreshButton = byId<HTMLButtonElement>("refreshButton");
const queueButton = byId<HTMLButtonElement>("queueButton");
const turnButton = byId<HTMLButtonElement>("turnButton");
const cellDialog = byId<HTMLDialogElement>("cellDialog");
const dialogTitle = byId("dialogTitle");
const dialogCommandList = byId("dialogCommandList");

apiBaseInput.value = defaultApiBase;
queuePosition.value = "0";

for (const kind of commandKinds) {
  const option = document.createElement("option");
  option.value = kind;
  option.textContent = commandLabels[kind];
  commandSelect.append(option);
}
commandSelect.value = selectedCommand;

apiBaseInput.addEventListener("change", () => {
  localStorage.setItem("hakoniwa.apiBase", apiBaseInput.value.trim());
});
islandSelect.addEventListener("change", () => {
  selectedIslandId = islandSelect.value;
  render();
});
commandSelect.addEventListener("change", () => {
  selectedCommand = commandSelect.value as CommandKind;
  void renderCommandCost();
});
refreshButton.addEventListener("click", () => {
  void loadState();
});
queueButton.addEventListener("click", () => {
  void submitCommand();
});
turnButton.addEventListener("click", () => {
  void advanceTurn();
});

void loadState();

async function loadState(): Promise<void> {
  setBusy(true);
  try {
    loaded = await apiGet<StateResponse>("/state");
    selectedIslandId = loaded.state.islands[0]?.id ?? selectedIslandId;
    connectionStatus.textContent = `接続中 / ターン ${loaded.state.turn}`;
    connectionStatus.className = "status status-ok";
    render();
    await loadLogs();
  } catch (error) {
    connectionStatus.textContent = errorMessage(error);
    connectionStatus.className = "status status-error";
  } finally {
    setBusy(false);
  }
}

async function submitCommand(): Promise<void> {
  const island = currentIsland();
  if (!island) return;

  const position = Number(queuePosition.value);
  const payload: CommandPlan & { islandId: string; position: number } = {
    islandId: island.id,
    position,
    kind: selectedCommand,
    x: selectedCell.x,
    y: selectedCell.y
  };

  setBusy(true);
  try {
    await apiPost("/command", payload);
    await loadState();
    showLocalLog(`${position + 1}番に ${commandLabels[selectedCommand]} (${selectedCell.x}, ${selectedCell.y}) を登録しました。`);
  } catch (error) {
    showLocalLog(errorMessage(error), true);
  } finally {
    setBusy(false);
  }
}

async function advanceTurn(): Promise<void> {
  setBusy(true);
  try {
    const result = await apiPost<TurnResult>("/turn", {});
    loaded = {
      state: result.state,
      rules: loaded?.rules ?? {
        turnSeconds: 21_600,
        commandQueueLength: 40,
        commandCosts: {} as Record<CommandKind, number>,
        commandDurations: {} as Record<CommandKind, number>
      }
    };
    render();
    renderLogs(result.logs.map((log) => ({ turn: result.state.turn, message: log.message })));
    connectionStatus.textContent = `接続中 / ターン ${result.state.turn}`;
    connectionStatus.className = "status status-ok";
  } catch (error) {
    showLocalLog(errorMessage(error), true);
  } finally {
    setBusy(false);
  }
}

function render(): void {
  const state = loaded?.state;
  if (!state) return;

  islandSelect.replaceChildren(
    ...state.islands.map((island) => {
      const option = document.createElement("option");
      option.value = island.id;
      option.textContent = island.name;
      option.selected = island.id === selectedIslandId;
      return option;
    })
  );

  const island = currentIsland();
  if (!island) return;

  renderStats(island);
  renderMap(island);
  renderQueue(island);
  renderSelectedCell(island);
  void renderCommandCost();
}

function renderStats(island: Island): void {
  const items = [
    ["資金", island.money],
    ["食料", island.food],
    ["人口", island.population],
    ["面積", island.area],
    ["農場", island.farmSize],
    ["工場", island.factorySize],
    ["採掘", island.mineSize],
    ["スコア", island.score]
  ];

  stats.replaceChildren(
    ...items.map(([label, value]) => {
      const item = document.createElement("div");
      item.className = "stat";
      item.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
      return item;
    })
  );
}

function renderMap(island: Island): void {
  map.replaceChildren();

  for (const row of island.cells) {
    for (const cell of row) {
      const button = document.createElement("button");
      button.className = `cell terrain-${cell.terrain}`;
      button.type = "button";
      button.style.setProperty("--x", String(cell.x));
      button.style.setProperty("--y", String(cell.y));
      button.style.setProperty("--row-offset", cell.y % 2 === 0 ? "0" : "0.5");
      button.dataset.selected = String(cell.x === selectedCell.x && cell.y === selectedCell.y);
      button.dataset.working = String(Boolean(cell.workKind));
      button.title = `${terrainLabels[cell.terrain]} (${cell.x}, ${cell.y}) value=${cell.value}`;
      button.textContent = cell.workKind ? workText(cell) : terrainGlyphs[cell.terrain] ?? "";
      button.addEventListener("click", () => {
        selectedCell = { x: cell.x, y: cell.y };
        renderMap(island);
        renderSelectedCell(island);
        void openCellDialog(cell);
      });
      map.append(button);
    }
  }
}

function renderSelectedCell(island: Island): void {
  const cell = island.cells[selectedCell.y]?.[selectedCell.x];
  if (!cell) {
    cellDetails.textContent = "セル未選択";
    return;
  }

  const work = cell.workKind
    ? ` / ${commandLabels[cell.workKind]} 残り${cell.workRemaining ?? 0}/${cell.workTotal ?? 0}`
    : "";
  cellDetails.textContent = `${terrainLabels[cell.terrain]} / x:${cell.x} y:${cell.y} / value:${cell.value}${work}`;
}

async function renderCommandCost(): Promise<void> {
  const island = currentIsland();
  if (!island) return;

  const fallbackCost = loaded?.rules.commandCosts[selectedCommand] ?? 0;
  const fallbackDuration = loaded?.rules.commandDurations[selectedCommand] ?? 0;
  commandCost.textContent = `費用 ${fallbackCost} / ${fallbackDuration}T`;

  try {
    const evaluation = await evaluateCommand(selectedCommand, island.id, selectedCell.x, selectedCell.y);
    commandCost.textContent = evaluation.canExecute
      ? `費用 ${evaluation.cost} / ${evaluation.duration}T`
      : `不可: ${evaluation.reason ?? "条件未達"}`;
  } catch {
    commandCost.textContent = `費用 ${fallbackCost} / ${fallbackDuration}T`;
  }
}

function renderQueue(island: Island): void {
  queue.replaceChildren(
    ...island.commandQueue.slice(0, 12).map((command, index) => {
      const item = document.createElement("button");
      item.className = "queue-item";
      item.type = "button";
      item.textContent = `${index + 1}. ${commandLabels[command.kind]} (${command.x}, ${command.y})`;
      item.addEventListener("click", () => {
        queuePosition.value = String(index);
        selectedCommand = command.kind;
        selectedCell = { x: command.x, y: command.y };
        commandSelect.value = selectedCommand;
        render();
      });
      return item;
    })
  );
}

function renderLogs(messages: Array<{ turn: number; message: string }>): void {
  logs.replaceChildren(
    ...messages.map((entry) => {
      const item = document.createElement("li");
      item.textContent = `T${entry.turn}: ${entry.message}`;
      return item;
    })
  );
}

async function loadLogs(): Promise<void> {
  try {
    const response = await apiGet<LogsResponse>("/logs");
    renderLogs(response.logs.map((log) => ({ turn: log.turn, message: log.message })));
  } catch {
    // Logs are supplementary; state rendering should not fail if this endpoint is absent.
  }
}

function showLocalLog(message: string, isError = false): void {
  const item = document.createElement("li");
  item.textContent = message;
  if (isError) item.className = "error-line";
  logs.prepend(item);
}

function currentIsland(): Island | undefined {
  return loaded?.state.islands.find((island) => island.id === selectedIslandId) ?? loaded?.state.islands[0];
}

async function openCellDialog(cell: Cell): Promise<void> {
  const island = currentIsland();
  if (!island) return;

  dialogTitle.textContent = `${terrainLabels[cell.terrain]} (${cell.x}, ${cell.y})`;
  dialogCommandList.replaceChildren();

  const evaluations = await Promise.all(
    commandKinds
      .filter((kind) => kind !== "doNothing")
      .map((kind) => evaluateCommand(kind, island.id, cell.x, cell.y))
  );

  dialogCommandList.replaceChildren(
    ...evaluations.map((evaluation) => commandChoiceButton(evaluation, island, cell))
  );

  cellDialog.showModal();
}

function commandChoiceButton(evaluation: CommandEvaluation, island: Island, cell: Cell): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "dialog-command";
  button.disabled = !evaluation.canExecute;
  const detail = evaluation.canExecute
    ? `費用 ${evaluation.cost} / ${evaluation.duration}T`
    : evaluation.reason ?? "実行できません";
  button.innerHTML = `<strong>${commandLabels[evaluation.command]}</strong><span>${detail}</span>`;
  button.addEventListener("click", () => {
    selectedCommand = evaluation.command;
    selectedCell = { x: cell.x, y: cell.y };
    commandSelect.value = selectedCommand;
    void submitCommandFor(island.id, evaluation.command, cell.x, cell.y);
    cellDialog.close();
  });
  return button;
}

async function submitCommandFor(
  islandId: string,
  kind: CommandKind,
  x: number,
  y: number
): Promise<void> {
  const position = Number(queuePosition.value);
  await apiPost("/command", { islandId, position, kind, x, y });
  await loadState();
  showLocalLog(`${position + 1}番に ${commandLabels[kind]} (${x}, ${y}) を登録しました。`);
}

async function evaluateCommand(
  kind: CommandKind,
  islandId: string,
  x: number,
  y: number
): Promise<CommandEvaluation> {
  return apiPost<CommandEvaluation>("/command/evaluate", { islandId, kind, x, y });
}

function workText(cell: Cell): string {
  const remaining = cell.workRemaining ?? 0;
  const total = cell.workTotal ?? 0;
  return `${remaining}/${total}`;
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`);
  return parseResponse<T>(response);
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  return parseResponse<T>(response);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : response.statusText);
  }
  return body as T;
}

function apiBase(): string {
  return apiBaseInput.value.trim().replace(/\/$/, "");
}

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`missing element: ${id}`);
  return element as T;
}

function setBusy(isBusy: boolean): void {
  refreshButton.disabled = isBusy;
  queueButton.disabled = isBusy;
  turnButton.disabled = isBusy;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
