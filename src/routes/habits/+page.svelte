<script>
	import { enhance } from '$app/forms';
	let { data, form } = $props();

	let showAdd = $state(false);
	let newRecurrence = $state('daily');

	// Close the add form when a habit is successfully created
	$effect(() => {
		if (form?.created) {
			showAdd = false;
			newRecurrence = 'daily';
		}
	});

	const RECURRENCE_LABELS = { daily: 'daily', weekly: 'weekly', monthly: 'monthly' };

	function missLabel(h) {
		if (h.missCount === 0) return '';
		const n = h.missCount;
		if (h.recurrence === 'daily') return n === 1 ? 'missed yesterday' : `missed ${n} days`;
		if (h.recurrence === 'weekly') return n === 1 ? 'missed last week' : `missed ${n} weeks`;
		return n === 1 ? 'missed last month' : `missed ${n} months`;
	}

	// Build last-8-week grid (56 days) for a habit
	function buildGrid(history) {
		const set = new Set(history);
		const today = new Date();
		const days = [];
		for (let i = 55; i >= 0; i--) {
			const d = new Date(today);
			d.setDate(d.getDate() - i);
			const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
			days.push({ date: str, done: set.has(str) });
		}
		return days;
	}

	// Week labels for grid: Mon Tue Wed … (leftmost column)
	const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
</script>

<div class="wrap">
	<a href="/" class="back muted">← wall</a>

	<header>
		<h1>Habits</h1>
		<button type="button" onclick={() => (showAdd = !showAdd)}>+ Add habit</button>
	</header>

	{#if showAdd}
		<form
			method="POST"
			action="?/create"
			use:enhance
			class="addbar"
		>
			<input name="name" placeholder="Habit name…" autofocus autocomplete="off" />
			<select name="recurrence" bind:value={newRecurrence}>
				{#each Object.entries(RECURRENCE_LABELS) as [val, label]}
					<option value={val}>{label}</option>
				{/each}
			</select>
			<button class="primary" type="submit">Add</button>
		</form>
	{/if}

	{#if data.habits.length === 0}
		<div class="empty">
			<p>No habits tracked yet.</p>
			<p class="muted">Add one above — daily, weekly, or monthly.</p>
		</div>
	{:else}
		{#each data.habits as h (h.id)}
			{@const grid = buildGrid(h.history)}
			<div class="habit-card">
				<div class="habit-top">
					<div class="habit-meta">
						<span class="hname">{h.name}</span>
						<span class="badge">{h.recurrence}</span>
						{#if h.missCount > 0}
							<span class="miss">⚠ {missLabel(h)}</span>
						{:else if h.doneToday}
							<span class="done-label">✓ done today</span>
						{/if}
					</div>
					<div class="habit-actions">
						<form method="POST" action="?/toggle" use:enhance class="inline">
							<input type="hidden" name="id" value={h.id} />
							<input type="hidden" name="date" value={data.today} />
							<button class="hcheck" class:on={h.doneToday} type="submit">
								{h.doneToday ? '✓' : ''}
							</button>
						</form>
						<form
							method="POST"
							action="?/remove"
							use:enhance
							class="inline"
							onsubmit={(e) => {
								if (!confirm(`Delete habit "${h.name}"?`)) e.preventDefault();
							}}
						>
							<input type="hidden" name="id" value={h.id} />
							<button class="icon del" type="submit" title="delete">✕</button>
						</form>
					</div>
				</div>

				<!-- 8-week grid -->
				<div class="grid-wrap">
					<div class="day-labels">
						{#each DAY_LABELS as d}
							<span>{d}</span>
						{/each}
					</div>
					<div class="cal-grid">
						{#each grid as cell}
							<div class="cell" class:lit={cell.done} title={cell.date}></div>
						{/each}
					</div>
				</div>
			</div>
		{/each}
	{/if}
</div>

<style>
	.back { display: inline-block; margin-bottom: 0.8rem; font-size: 0.9rem; }
	header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
	h1 { margin: 0; }

	.addbar {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 0.7rem;
		margin-bottom: 1.25rem;
	}
	.addbar input { flex: 1; }
	.addbar select {
		background: var(--panel-2);
		border: 1px solid var(--line);
		border-radius: 10px;
		padding: 0.55rem 0.7rem;
		color: var(--text);
	}

	.empty {
		text-align: center;
		padding: 4rem 1rem;
		border: 1px dashed var(--line);
		border-radius: var(--radius);
	}
	.empty p { margin: 0.2rem 0; }

	.habit-card {
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 1rem;
		margin-bottom: 0.8rem;
	}

	.habit-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.8rem;
	}
	.habit-meta { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
	.hname { font-weight: 600; }
	.badge {
		font-size: 0.75rem;
		background: var(--panel-2);
		border: 1px solid var(--line);
		border-radius: 99px;
		padding: 0.1rem 0.5rem;
		color: var(--muted);
	}
	.miss { font-size: 0.82rem; color: var(--hot); }
	.done-label { font-size: 0.82rem; color: var(--green); }

	.habit-actions { display: flex; gap: 0.4rem; align-items: center; flex-shrink: 0; }
	.inline { display: inline-flex; margin: 0; }

	.hcheck {
		width: 28px; height: 28px; padding: 0;
		border-radius: 50%; border: 2px solid var(--line);
		background: transparent; font-size: 0.85rem; color: var(--green);
	}
	.hcheck:hover { border-color: var(--green); }
	.hcheck.on { border-color: var(--green); background: rgba(90,209,154,0.15); }

	.icon { border: none; background: transparent; padding: 0.2rem 0.4rem; color: var(--muted); }
	.icon.del:hover { color: var(--hot); }

	/* 8-week calendar grid */
	.grid-wrap { display: flex; gap: 0.3rem; align-items: stretch; }

	.day-labels {
		display: grid;
		grid-template-rows: repeat(7, 1fr);
		gap: 2px;
		font-size: 0.65rem;
		color: var(--muted);
		padding-top: 1px;
	}
	.day-labels span { line-height: 12px; }

	.cal-grid {
		display: grid;
		grid-template-rows: repeat(7, 12px);
		grid-auto-flow: column;
		gap: 2px;
	}
	.cell {
		width: 12px; height: 12px;
		border-radius: 2px;
		background: var(--panel-2);
	}
	.cell.lit { background: var(--green); }
</style>
