import { Fragment, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Alert, Code, Container, Group, List, Paper, Stack, Table, Text, Title } from "@mantine/core";
import { LineChart } from "@mantine/charts";
import type { Account, Budget, Cents } from "./data/types";
import { validateBudget } from "./data/validate";
import { forecast, type MonthRow } from "./engine/forecast";
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

function Dashboard({ budget }: { budget: Budget }) {
  const today = dayjs().format("YYYY-MM-DD");
  const f = useMemo(() => forecast(budget, today), [budget, today]);
  const accounts = budget.accounts;

  const chartData = f.daily.map((p) => ({
    date: dayjs(p.date).format("MMM D"),
    ...Object.fromEntries(accounts.map((a) => [a.name, (p.balances[a.id] ?? 0) / 100])),
  }));
  const colors = ["blue.6", "teal.6", "grape.6", "orange.6"];

  return (
    <Stack gap="lg">
      <Group grow align="stretch">
        {accounts.map((a) => {
          const low = f.lowest[a.id];
          return (
            <Paper key={a.id} withBorder p="md" radius="md">
              <Text size="sm" c="dimmed">
                {a.name}: lowest balance
              </Text>
              <Text size="xl" fw={600} c={low && low.balance < 0 ? "red" : undefined}>
                {low ? fmtMoney(low.balance) : "n/a"}
              </Text>
              <Text size="sm" c="dimmed">
                {low ? `on ${fmtDate(low.date)}` : ""} · forecast to {fmtDate(f.to)}
              </Text>
            </Paper>
          );
        })}
      </Group>

      <Paper withBorder p="md" radius="md">
        <LineChart
          h={300}
          data={chartData}
          dataKey="date"
          series={accounts.map((a, i) => ({ name: a.name, color: colors[i % colors.length]! }))}
          curveType="stepAfter"
          withDots={false}
          withLegend={accounts.length > 1}
          valueFormatter={(v) => money.format(v)}
          yAxisProps={{ width: 90 }}
        />
      </Paper>

      <MonthTable months={f.months} accounts={accounts} />
      <Text size="xs" c="dimmed">
        Click a month to see its items. The first and last months are partial: only items from today up to the end of the forecast are counted.
      </Text>
    </Stack>
  );
}

function MonthTable({ months, accounts }: { months: MonthRow[]; accounts: Account[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const names = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
  const cols = 4 + accounts.length;
  return (
    <Paper withBorder radius="md">
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Month</Table.Th>
            <Table.Th ta="right">In</Table.Th>
            <Table.Th ta="right">Out</Table.Th>
            <Table.Th ta="right">Net</Table.Th>
            {accounts.map((a) => (
              <Table.Th key={a.id} ta="right">
                {a.name} (end)
              </Table.Th>
            ))}
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
                <Table.Td>
                  {open === m.month ? "▾" : "▸"} {fmtMonth(m.month)}
                </Table.Td>
                <Table.Td ta="right">{fmtMoney(m.in)}</Table.Td>
                <Table.Td ta="right">{fmtMoney(m.out)}</Table.Td>
                <Table.Td ta="right" c={m.net < 0 ? "red" : undefined}>
                  {fmtMoney(m.net)}
                </Table.Td>
                {accounts.map((a) => (
                  <Table.Td key={a.id} ta="right">
                    {fmtMoney(m.end[a.id] ?? 0)}
                  </Table.Td>
                ))}
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
                          {m.occurrences.map((o, i) => (
                            <Table.Tr key={i}>
                              <Table.Td>{dayjs(o.date).format("MMM D")}</Table.Td>
                              <Table.Td>{o.name}</Table.Td>
                              <Table.Td c="dimmed">{o.category}</Table.Td>
                              <Table.Td c="dimmed">{names[o.account]}</Table.Td>
                              <Table.Td ta="right" c={o.kind === "income" ? "teal" : undefined}>
                                {o.kind === "income" ? "+" : "−"}
                                {fmtMoney(o.amount)}
                              </Table.Td>
                              <Table.Td ta="right" c="dimmed">
                                {fmtMoney(o.balanceAfter)}
                              </Table.Td>
                            </Table.Tr>
                          ))}
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
