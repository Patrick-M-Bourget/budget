import { Fragment, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Alert, Chip, Code, Container, Group, List, Paper, SegmentedControl, SimpleGrid, Stack, Table, Text, Title } from "@mantine/core";
import { LineChart } from "@mantine/charts";
import type { Account, Budget, Cents } from "./data/types";
import { validateBudget } from "./data/validate";
import { comparePlans, CURRENT_PLAN, type MonthRow } from "./engine/forecast";
import { useBudgetFile } from "./useBudgetFile";

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const fmtMoney = (c: Cents) => money.format(c / 100);
const fmtDate = (d: string) => dayjs(d).format("MMM D, YYYY");
/** Long file paths would otherwise run off narrow screens. */
const wrap = { whiteSpace: "pre-wrap", wordBreak: "break-all" } as const;
const fmtMonth = (m: string) => dayjs(`${m}-01`).format("MMM YYYY");

export function App() {
  const file = useBudgetFile();

  return (
    <Container size="lg" py="lg">
      <Stack gap="lg">
        <Title order={2}>Budget</Title>
        {file.status === "loading" && <Text c="dimmed">Loading…</Text>}
        {file.status === "offline" && (
          <Alert color="red" title="Can't reach the local server">
            Is <Code>npm start</Code> still running? ({file.error})
          </Alert>
        )}
        {file.status === "missing" && (
          <Alert color="yellow" title="No budget file yet">
            <Text size="sm">
              Nothing at <Code style={wrap}>{file.path}</Code>. Start from the example:
            </Text>
            <Code block mt="xs" style={wrap}>{`mkdir -p "${file.path.replace(/\/[^/]+$/, "")}" && cp examples/sample.json "${file.path}"`}</Code>
            <Text size="sm" mt="xs">
              Or point <Code>BUDGET_FILE</Code> at another file. This page updates by itself when the file appears.
            </Text>
          </Alert>
        )}
        {file.status === "unreadable" && (
          <Alert color="red" title="Can't read the budget file">
            <Code style={wrap}>{file.path}</Code>
            <Text size="sm" mt="xs">{file.error}</Text>
          </Alert>
        )}
        {file.status === "ok" && <Loaded json={file.json} path={file.path} />}
      </Stack>
    </Container>
  );
}

function Loaded({ json, path }: { json: unknown; path: string }) {
  const result = useMemo(() => validateBudget(json), [json]);
  if (!result.ok)
    return (
      <Alert color="red" title={`The budget file has ${result.errors.length} problem(s)`}>
        <Code style={wrap}>{path}</Code>
        <List size="sm" mt="xs">
          {result.errors.map((e) => (
            <List.Item key={e}>
              <Code>{e}</Code>
            </List.Item>
          ))}
        </List>
      </Alert>
    );
  return <Dashboard budget={result.budget} />;
}

type Metric = "netWorth" | "cash" | "debt";
const METRICS: { key: Metric; title: string }[] = [
  { key: "netWorth", title: "Net worth (home value not counted)" },
  { key: "cash", title: "Cash (chequing + savings)" },
  { key: "debt", title: "Debt owed" },
];
const PLAN_COLORS = ["blue.6", "orange.6", "grape.6", "teal.6", "red.6", "lime.6"];

/** A debt's value is negative inside the engine; show it as the amount owed. */
const fmtAccount = (a: Account, v: Cents) => fmtMoney(a.kind === "debt" ? -v : v);

function Dashboard({ budget }: { budget: Budget }) {
  const today = dayjs().format("YYYY-MM-DD");
  const allIds = budget.scenarios.map((s) => s.id);
  // Scenarios start switched on; ones added to the file later appear switched on too.
  const [hidden, setHidden] = useState<string[]>([]);
  const active = allIds.filter((id) => !hidden.includes(id));
  const activeKey = active.join("|");
  const plans = useMemo(() => comparePlans(budget, today, active), [budget, today, activeKey]);
  const [shownId, setShownId] = useState(CURRENT_PLAN);
  const accounts = budget.accounts;
  const cashAccounts = accounts.filter((a) => a.kind === "cash");
  const shown = plans.find((p) => p.id === shownId) ?? plans[0]!;
  const color = (i: number) => PLAN_COLORS[i % PLAN_COLORS.length]!;

  return (
    <Stack gap="lg">
      {budget.scenarios.length > 0 && (
        <Group gap="xs">
          <Text size="sm" c="dimmed">
            Compare with:
          </Text>
          <Chip.Group multiple value={active} onChange={(on) => setHidden(allIds.filter((id) => !on.includes(id)))}>
            {budget.scenarios.map((sc) => (
              <Chip key={sc.id} value={sc.id} size="sm">
                {sc.name}
                {sc.contingencyPercent > 0 ? ` (+${sc.contingencyPercent}% contingency)` : ""}
              </Chip>
            ))}
          </Chip.Group>
        </Group>
      )}
      <Group grow align="stretch">
        {cashAccounts.map((a) => (
          <Paper key={a.id} withBorder p="md" radius="md">
            <Text size="sm" c="dimmed">
              {a.name}: lowest balance
            </Text>
            {plans.map((p, i) => {
              const low = p.forecast.lowest[a.id];
              return (
                <Group key={p.id} justify="space-between" gap="xs" wrap="nowrap">
                  {plans.length > 1 && (
                    <Text size="sm" c={color(i)}>
                      {p.name}
                    </Text>
                  )}
                  <Text size="lg" fw={600} c={low && low.balance < 0 ? "red" : undefined}>
                    {low ? fmtMoney(low.balance) : "n/a"}
                    <Text span size="sm" c="dimmed" fw={400}>
                      {low ? ` on ${fmtDate(low.date)}` : ""}
                    </Text>
                  </Text>
                </Group>
              );
            })}
          </Paper>
        ))}
      </Group>

      <SimpleGrid cols={{ base: 1, md: 3 }}>
        {METRICS.map((m) => (
          <Paper key={m.key} withBorder p="md" radius="md">
            <Text size="sm" fw={600} mb="xs">
              {m.title}
            </Text>
            <LineChart
              h={220}
              data={shown.forecast.daily.map((d, i) => ({
                date: d.date,
                ...Object.fromEntries(plans.map((p) => [p.name, (p.forecast.daily[i]?.totals[m.key] ?? 0) / 100])),
              }))}
              dataKey="date"
              series={plans.map((p, i) => ({ name: p.name, color: color(i) }))}
              curveType="stepAfter"
              withDots={false}
              withLegend={plans.length > 1}
              valueFormatter={(v) => money.format(v)}
              yAxisProps={{ width: 90, domain: ["auto", "auto"] }}
              xAxisProps={{ tickFormatter: (d: string) => dayjs(d).format("MMM YY"), minTickGap: 24 }}
              tooltipProps={{ labelFormatter: (d) => fmtDate(String(d)) }}
              referenceLines={shown.forecast.markers.map((mk) => ({ x: mk.date, label: mk.label, color: "gray.6" }))}
            />
          </Paper>
        ))}
      </SimpleGrid>

      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Forecast from {fmtDate(shown.forecast.from)} to {fmtDate(shown.forecast.to)}.
        </Text>
        {plans.length > 1 && (
          <SegmentedControl
            size="xs"
            value={shown.id}
            onChange={setShownId}
            data={plans.map((p) => ({ value: p.id, label: p.name }))}
          />
        )}
      </Group>
      <MonthTable months={shown.forecast.months} accounts={accounts} />
      <Text size="xs" c="dimmed">
        Click a month to see its items. In and out leave transfers out. The first and last months are partial: only
        items from today up to the end of the forecast are counted.
      </Text>
    </Stack>
  );
}

function MonthTable({ months, accounts }: { months: MonthRow[]; accounts: Account[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const byId = Object.fromEntries(accounts.map((a) => [a.id, a]));
  const cols = 5 + accounts.length;
  return (
    <Paper withBorder radius="md" style={{ overflowX: "auto" }}>
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Month</Table.Th>
            <Table.Th ta="right">In</Table.Th>
            <Table.Th ta="right">Out</Table.Th>
            <Table.Th ta="right">Net</Table.Th>
            {accounts.map((a) => (
              <Table.Th key={a.id} ta="right">
                {a.name} ({a.kind === "debt" ? "owed" : "end"})
              </Table.Th>
            ))}
            <Table.Th ta="right">Net worth</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {months.map((m) => (
            <Fragment key={m.month}>
              <Table.Tr
                style={{ cursor: "pointer" }}
                onClick={() => setOpen(open === m.month ? null : m.month)}
                aria-expanded={open === m.month}
              >
                <Table.Td style={{ whiteSpace: "nowrap" }}>
                  {open === m.month ? "▾" : "▸"} {fmtMonth(m.month)}
                </Table.Td>
                <Table.Td ta="right">{fmtMoney(m.in)}</Table.Td>
                <Table.Td ta="right">{fmtMoney(m.out)}</Table.Td>
                <Table.Td ta="right" c={m.net < 0 ? "red" : undefined}>
                  {fmtMoney(m.net)}
                </Table.Td>
                {accounts.map((a) => (
                  <Table.Td key={a.id} ta="right">
                    {fmtAccount(a, m.end[a.id] ?? 0)}
                  </Table.Td>
                ))}
                <Table.Td ta="right" fw={600}>
                  {fmtMoney(m.endTotals.netWorth)}
                </Table.Td>
              </Table.Tr>
              {open === m.month && (
                <Table.Tr>
                  <Table.Td colSpan={cols} bg="var(--mantine-color-default-hover)">
                    {m.occurrences.length === 0 ? (
                      <Text size="sm" c="dimmed">
                        Nothing due this month.
                      </Text>
                    ) : (
                      <Table withRowBorders={false} verticalSpacing={4}>
                        <Table.Tbody>
                          {m.occurrences.map((o, i) => {
                            const from = byId[o.account];
                            const sign = o.kind === "income" ? "+" : o.kind === "expense" ? "−" : "";
                            return (
                              <Table.Tr key={i}>
                                <Table.Td>{dayjs(o.date).format("MMM D")}</Table.Td>
                                <Table.Td>{o.name}</Table.Td>
                                <Table.Td c="dimmed">{o.category}</Table.Td>
                                <Table.Td c="dimmed">
                                  {from?.name}
                                  {o.to !== undefined && ` → ${byId[o.to]?.name}`}
                                </Table.Td>
                                <Table.Td ta="right" c={o.kind === "income" ? "teal" : o.kind === "transfer" ? "dimmed" : undefined}>
                                  {sign}
                                  {fmtMoney(o.amount)}
                                </Table.Td>
                                <Table.Td ta="right" c="dimmed">
                                  {from ? fmtAccount(from, o.balanceAfter) : ""}
                                </Table.Td>
                              </Table.Tr>
                            );
                          })}
                        </Table.Tbody>
                      </Table>
                    )}
                  </Table.Td>
                </Table.Tr>
              )}
            </Fragment>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
