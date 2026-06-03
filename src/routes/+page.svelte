<script>
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	let { data } = $props();

	let showAdd = $state(false);
	let colors = ['#6ea8fe', '#5ad19a', '#ffd166', '#ff8c66', '#c792ea', '#80d8e8'];
	let picked = $state(colors[0]);

	// Mutable project list for drag reorder
	let projects = $state([...data.projects]);
	$effect(() => { projects = [...data.projects]; });

	let draggedId = $state(null);
	let reorderForm = $state(null);
	let reorderIds = $state('');

	function onDragStart(e, id) {
		draggedId = id;
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData('text/plain', String(id));
	}

	function onDragOver(e, id) {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
		if (draggedId == null || draggedId === id) return;
		const fromIdx = projects.findIndex((p) => p.id === draggedId);
		const toIdx = projects.findIndex((p) => p.id === id);
		if (fromIdx === -1 || toIdx === -1) return;
		const next = [...projects];
		const [item] = next.splice(fromIdx, 1);
		next.splice(toIdx, 0, item);
		projects = next;
	}

	async function onDrop(e) {
		e.preventDefault();
		if (draggedId == null) return;
		draggedId = null;
		reorderIds = projects.map((p) => p.id).join(',');
		await tick();
		reorderForm?.requestSubmit();
	}

	// Staleness helpers
	function toMs(iso) {
		if (!iso) return Date.now();
		return iso instanceof Date ? iso.getTime() : new Date(iso.replace(' ', 'T') + 'Z').getTime();
	}
	function ago(iso) {
		if (!iso) return '';
		const days = Math.floor((Date.now() - toMs(iso)) / 86_400_000);
		if (days <= 0) return 'today';
		if (days === 1) return 'yesterday';
		return `${days}d ago`;
	}
	function staleDays(iso) {
		if (!iso) return 0;
		return Math.max(0, Math.floor((Date.now() - toMs(iso)) / 86_400_000));
	}
	function pulse(iso) {
		const d = staleDays(iso);
		if (d <= 1) return { c: 'var(--green)', label: ago(iso) };
		if (d <= 4) return { c: 'var(--accent)', label: ago(iso) };
		if (d <= 9) return { c: 'var(--muted)', label: ago(iso) };
		return { c: '#5b6270', label: ago(iso) };
	}
	function pct(p) {
		return p.total ? Math.round((p.done / p.total) * 100) : 0;
	}

	// Habit helpers
	function missLabel(h) {
		if (h.missCount === 0) return '';
		const n = h.missCount;
		if (h.recurrence === 'daily') return n === 1 ? 'missed yesterday' : `missed ${n}d`;
		if (h.recurrence === 'weekly') return n === 1 ? 'missed last week' : `missed ${n}w`;
		return n === 1 ? 'missed last month' : `missed ${n}mo`;
	}
</script>

<div class="wrap">
	<header>
		<div>
			<div class="brand">muhasabah <span>✓</span></div>
			<div class="muted small">
				{data.counts.active} active · {data.counts.backlog} backlog · {data.counts.done} done
			</div>
		</div>
		<div class="actions">
			<a href="/habits" class="btn">Habits</a>
			<button onclick={() => (showAdd = !showAdd)}>+ Project</button>
			<form method="POST" action="?/logout" use:enhance style="display:inline">
				<button type="submit">Logout</button>
			</form>
		</div>
	</header>

	<!-- Habits strip -->
	{#if data.habits.length > 0}
		<section class="habits-strip">
			<div class="habits-head">
				<span class="small muted">today's habits</span>
				<a href="/habits" class="small muted habits-link">manage →</a>
			</div>
			<div class="habits-list">
				{#each data.habits as h (h.id)}
					<form method="POST" action="?/habitToggle" use:enhance class="habit-row">
						<input type="hidden" name="id" value={h.id} />
						<input type="hidden" name="date" value={data.today} />
						<button class="hcheck" class:on={h.doneToday} type="submit" aria-label="toggle">
							{h.doneToday ? '✓' : ''}
						</button>
						<span class="hname" class:hdone={h.doneToday}>{h.name}</span>
						{#if h.missCount > 0}
							<span class="miss">{missLabel(h)}</span>
						{/if}
					</form>
				{/each}
			</div>
		</section>
	{:else}
		<div class="habits-empty small muted">
			<a href="/habits">+ add daily habits</a>
		</div>
	{/if}

	{#if showAdd}
		<form
			method="POST"
			action="?/create"
			use:enhance={() => async ({ update }) => { await update(); showAdd = false; }}
			class="addbar"
		>
			<input name="name" placeholder="New project name…" autofocus autocomplete="off" />
			<div class="swatches">
				{#each colors as c}
					<label class="swatch" style="--c:{c}" class:on={picked === c}>
						<input type="radio" name="color" value={c} bind:group={picked} hidden />
					</label>
				{/each}
			</div>
			<button class="primary" type="submit">Add</button>
		</form>
	{/if}

	<!-- Hidden form for reorder POST -->
	<form
		bind:this={reorderForm}
		method="POST"
		action="?/reorder"
		use:enhance
		style="display:none"
	>
		<input type="hidden" name="ids" bind:value={reorderIds} />
	</form>

	{#if projects.length === 0}
		<div class="empty">
			<p>Nothing on the wall yet.</p>
			<p class="muted">Add a project — it'll sit here so you never forget it exists.</p>
		</div>
	{:else}
		<div class="grid">
			{#each projects as p (p.id)}
				{@const pl = pulse(p.last_touched_at)}
				<a
					class="card"
					href="/projects/{p.id}"
					style="--accent:{p.color}"
					class:dragging={draggedId === p.id}
					draggable="true"
					ondragstart={(e) => onDragStart(e, p.id)}
					ondragover={(e) => onDragOver(e, p.id)}
					ondrop={onDrop}
					ondragend={() => (draggedId = null)}
				>
					<div class="drag-handle" title="drag to reorder">⠿</div>
					<div class="top">
						<span class="name">{p.name}</span>
						{#if p.hot > 0}<span class="hot" title="starred & open">🔥 {p.hot}</span>{/if}
					</div>

					<div class="bar"><span style="width:{pct(p)}%"></span></div>
					<div class="meta small">
						<span>{p.done}/{p.total} · {pct(p)}%</span>
						<span class="dot" style="--c:{pl.c}" title="last touched {pl.label}">{pl.label}</span>
					</div>

					{#if p.next.length}
						<ul class="next">
							{#each p.next as t}<li>{t}</li>{/each}
							{#if p.total - p.done > p.next.length}
								<li class="more">+{p.total - p.done - p.next.length} more</li>
							{/if}
						</ul>
					{:else if p.total > 0}
						<div class="cleared small">all caught up ✓</div>
					{:else}
						<div class="cleared small muted">no tasks yet</div>
					{/if}

					{#if p.doneToday > 0}
						<div class="today small">▮ {p.doneToday} done today</div>
					{/if}
				</a>
			{/each}
		</div>
	{/if}
</div>

<style>
	header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.brand { font-size: 1.5rem; font-weight: 700; }
	.brand span { color: var(--green); }
	.small { font-size: 0.82rem; }
	.actions { display: flex; gap: 0.5rem; align-items: center; }
	.btn {
		border: 1px solid var(--line);
		background: var(--panel-2);
		border-radius: 10px;
		padding: 0.55rem 0.9rem;
		font-size: inherit;
		cursor: pointer;
	}
	.btn:hover { border-color: var(--accent); }

	/* Habits strip */
	.habits-strip {
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 0.75rem 0.9rem;
		margin-bottom: 1rem;
	}
	.habits-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}
	.habits-link { text-decoration: none; }
	.habits-link:hover { color: var(--accent); }
	.habits-list { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; }
	.habit-row {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0;
		background: none;
		border: none;
		padding: 0;
	}
	.hcheck {
		width: 22px; height: 22px; padding: 0; flex-shrink: 0;
		border-radius: 50%; border: 2px solid var(--line);
		background: transparent; font-size: 0.75rem; color: var(--green);
	}
	.hcheck:hover { border-color: var(--green); }
	.hcheck.on { border-color: var(--green); background: rgba(90,209,154,0.15); }
	.hname { font-size: 0.9rem; }
	.hdone { color: var(--muted); text-decoration: line-through; }
	.miss { font-size: 0.75rem; color: var(--hot); }
	.habits-empty { margin-bottom: 1rem; }
	.habits-empty a { color: var(--muted); }
	.habits-empty a:hover { color: var(--accent); }

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
	.addbar input[name='name'] { flex: 1; }
	.swatches { display: flex; gap: 0.3rem; }
	.swatch {
		width: 20px; height: 20px; border-radius: 50%;
		background: var(--c); cursor: pointer; opacity: 0.5;
		border: 2px solid transparent;
	}
	.swatch.on { opacity: 1; border-color: #fff; }

	.empty {
		text-align: center;
		padding: 4rem 1rem;
		border: 1px dashed var(--line);
		border-radius: var(--radius);
	}
	.empty p { margin: 0.2rem 0; }

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
		gap: 0.9rem;
	}
	.card {
		display: block;
		position: relative;
		background: var(--panel);
		border: 1px solid var(--line);
		border-left: 3px solid var(--accent);
		border-radius: var(--radius);
		padding: 0.9rem 0.9rem 0.9rem 0.7rem;
		transition: transform 0.08s ease, border-color 0.08s ease;
		cursor: grab;
	}
	.card:hover { transform: translateY(-2px); border-color: var(--accent); }
	.card.dragging { opacity: 0.4; cursor: grabbing; }

	.drag-handle {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		color: var(--line);
		font-size: 0.85rem;
		pointer-events: none;
		letter-spacing: -1px;
	}

	.top { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
	.name { font-weight: 600; }
	.hot { font-size: 0.8rem; color: var(--hot); white-space: nowrap; }

	.bar {
		height: 6px;
		background: var(--panel-2);
		border-radius: 99px;
		overflow: hidden;
		margin: 0.7rem 0 0.4rem;
	}
	.bar span { display: block; height: 100%; background: var(--accent); }

	.meta { display: flex; justify-content: space-between; color: var(--muted); }
	.dot::before {
		content: '';
		display: inline-block;
		width: 7px; height: 7px;
		border-radius: 50%;
		background: var(--c);
		margin-right: 5px;
		vertical-align: middle;
	}

	.next { list-style: none; padding: 0; margin: 0.7rem 0 0; }
	.next li {
		font-size: 0.86rem;
		padding: 0.15rem 0;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.next li::before { content: '▸ '; color: var(--muted); }
	.next .more { color: var(--muted); }
	.next .more::before { content: ''; }

	.cleared { margin-top: 0.7rem; color: var(--green); }
	.today { margin-top: 0.5rem; color: var(--green); }
</style>
