<script>
	import { enhance } from '$app/forms';
	let { data } = $props();

	let showRecurrence = $state(false);
	let recurrence = $state('');
	let customDays = $state(7);

	const RECURRENCE_OPTS = [
		{ value: 'daily',   label: 'Daily' },
		{ value: 'weekly',  label: 'Weekly' },
		{ value: 'monthly', label: 'Monthly' },
		{ value: 'custom',  label: 'Every N days' }
	];

	function today() {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	// Task buckets
	const active   = $derived(data.tasks.filter((t) => !t.recurrence && !t.done));
	const snoozed  = $derived(data.tasks.filter((t) => t.recurrence && t.next_due && toStr(t.next_due) > today()));
	const recurDue = $derived(data.tasks.filter((t) => t.recurrence && (!t.next_due || toStr(t.next_due) <= today())));
	const done     = $derived(data.tasks.filter((t) => t.done && !t.recurrence));

	const openCount = $derived(active.length + recurDue.length);
	const totalCount = $derived(openCount + done.length); // snoozed don't count
	const pct = $derived(totalCount ? Math.round((done.length / totalCount) * 100) : 0);

	function toStr(v) {
		if (!v) return '';
		if (v instanceof Date) return v.toISOString().slice(0, 10);
		return String(v).slice(0, 10);
	}

	function recurLabel(t) {
		if (t.recurrence === 'custom') return `every ${t.recurrence_days}d`;
		return t.recurrence;
	}

	function nextDueLabel(t) {
		const s = toStr(t.next_due);
		if (!s) return '';
		const d = new Date(s + 'T00:00:00');
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}
</script>

<div class="wrap" style="--accent:{data.project.color}">
	<a href="/" class="back muted">← wall</a>

	<header>
		<h1>{data.project.name}</h1>
		<form method="POST" action="?/setStatus" use:enhance class="status">
			<select name="status" onchange={(e) => e.target.form.requestSubmit()}>
				{#each ['active', 'backlog', 'done', 'dropped'] as s}
					<option value={s} selected={data.project.status === s}>{s}</option>
				{/each}
			</select>
		</form>
	</header>

	<div class="bar"><span style="width:{pct}%"></span></div>
	<div class="muted small">{done.length}/{totalCount} done · {pct}%</div>

	<form method="POST" action="?/addTask" use:enhance={() => async ({ update }) => {
		await update();
		showRecurrence = false;
		recurrence = '';
		customDays = 7;
	}} class="addtask">
		<div class="addrow">
			<input name="title" placeholder="Add a task…" autocomplete="off" autofocus />
			<button
				type="button"
				class="recur-toggle"
				class:active={showRecurrence}
				onclick={() => { showRecurrence = !showRecurrence; if (!showRecurrence) recurrence = ''; }}
				title="Set recurrence"
			>↻</button>
			<button class="primary" type="submit">Add</button>
		</div>
		{#if showRecurrence}
			<div class="recur-opts">
				<span class="small muted">repeats:</span>
				{#each RECURRENCE_OPTS as opt}
					<label class="ropt" class:on={recurrence === opt.value}>
						<input type="radio" name="recurrence" value={opt.value} bind:group={recurrence} hidden />
						{opt.label}
					</label>
				{/each}
				{#if recurrence === 'custom'}
					<input
						type="number"
						name="recurrence_days"
						bind:value={customDays}
						min="1"
						max="365"
						class="days-input"
					/>
					<span class="small muted">days</span>
				{/if}
			</div>
		{/if}
	</form>

	<!-- Due recurring tasks -->
	{#if recurDue.length > 0}
		<div class="section-head small muted">recurring · due</div>
		<ul class="tasks">
			{#each recurDue as t (t.id)}
				<li>
					<form method="POST" action="?/toggle" use:enhance class="inline">
						<input type="hidden" name="id" value={t.id} />
						<button class="check recur" type="submit" aria-label="done" title="mark done (snoozes until next {recurLabel(t)})">↻</button>
					</form>
					<span class="title">{t.title}</span>
					<span class="recur-badge">{recurLabel(t)}</span>
					<form method="POST" action="?/star" use:enhance class="inline">
						<input type="hidden" name="id" value={t.id} />
						<button class="icon" class:on={t.starred} type="submit" title="star">★</button>
					</form>
					<form method="POST" action="?/removeTask" use:enhance class="inline">
						<input type="hidden" name="id" value={t.id} />
						<button class="icon del" type="submit" title="delete">✕</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}

	<!-- Regular open tasks -->
	{#if active.length > 0 || (recurDue.length === 0 && done.length === 0 && snoozed.length === 0)}
		{#if recurDue.length > 0}
			<div class="section-head small muted">open</div>
		{/if}
		<ul class="tasks">
			{#each active as t (t.id)}
				<li>
					<form method="POST" action="?/toggle" use:enhance class="inline">
						<input type="hidden" name="id" value={t.id} />
						<button class="check" type="submit" aria-label="done"></button>
					</form>
					<span class="title">{t.title}</span>
					<form method="POST" action="?/star" use:enhance class="inline">
						<input type="hidden" name="id" value={t.id} />
						<button class="icon" class:on={t.starred} type="submit" title="star">★</button>
					</form>
					<form method="POST" action="?/removeTask" use:enhance class="inline">
						<input type="hidden" name="id" value={t.id} />
						<button class="icon del" type="submit" title="delete">✕</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}

	<!-- Snoozed recurring tasks -->
	{#if snoozed.length > 0}
		<div class="section-head small muted">recurring · scheduled</div>
		<ul class="tasks snoozed">
			{#each snoozed as t (t.id)}
				<li>
					<form method="POST" action="?/toggle" use:enhance class="inline">
						<input type="hidden" name="id" value={t.id} />
						<button class="check recur dim" type="submit" aria-label="bring back now" title="bring back now">↻</button>
					</form>
					<span class="title dim">{t.title}</span>
					<span class="recur-badge">{recurLabel(t)}</span>
					<span class="next-due small muted">due {nextDueLabel(t)}</span>
					<form method="POST" action="?/removeTask" use:enhance class="inline">
						<input type="hidden" name="id" value={t.id} />
						<button class="icon del" type="submit" title="delete">✕</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}

	{#if done.length}
		<div class="section-head small muted">done</div>
		<ul class="tasks done">
			{#each done as t (t.id)}
				<li>
					<form method="POST" action="?/toggle" use:enhance class="inline">
						<input type="hidden" name="id" value={t.id} />
						<button class="check on" type="submit" aria-label="undo">✓</button>
					</form>
					<span class="title struck">{t.title}</span>
					<form method="POST" action="?/removeTask" use:enhance class="inline">
						<input type="hidden" name="id" value={t.id} />
						<button class="icon del" type="submit" title="delete">✕</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}

	<form
		method="POST"
		action="?/removeProject"
		use:enhance
		class="danger"
		onsubmit={(e) => { if (!confirm('Delete this project and all its tasks?')) e.preventDefault(); }}
	>
		<button type="submit" class="del">Delete project</button>
	</form>
</div>

<style>
	.back { display: inline-block; margin-bottom: 0.8rem; font-size: 0.9rem; }
	header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
	h1 { margin: 0; border-left: 4px solid var(--accent); padding-left: 0.6rem; }
	.small { font-size: 0.82rem; }
	select { background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 0.4rem 0.6rem; }

	.bar { height: 8px; background: var(--panel-2); border-radius: 99px; overflow: hidden; margin: 1rem 0 0.3rem; }
	.bar span { display: block; height: 100%; background: var(--accent); }

	.addtask { margin: 1.25rem 0; }
	.addrow { display: flex; gap: 0.5rem; }
	.addrow input { flex: 1; }

	.recur-toggle {
		border: 1px solid var(--line);
		background: var(--panel-2);
		border-radius: 10px;
		padding: 0.55rem 0.75rem;
		font-size: 1rem;
		color: var(--muted);
		flex-shrink: 0;
	}
	.recur-toggle:hover, .recur-toggle.active { border-color: var(--accent); color: var(--accent); }

	.recur-opts {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
		margin-top: 0.5rem;
		padding: 0.5rem 0.6rem;
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 10px;
	}
	.ropt {
		font-size: 0.82rem;
		padding: 0.2rem 0.6rem;
		border: 1px solid var(--line);
		border-radius: 99px;
		cursor: pointer;
		color: var(--muted);
	}
	.ropt.on { border-color: var(--accent); color: var(--accent); background: rgba(110,168,254,0.08); }
	.days-input {
		width: 60px;
		padding: 0.2rem 0.4rem;
		font-size: 0.82rem;
	}

	.section-head {
		margin: 1.2rem 0 0.3rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.tasks { list-style: none; padding: 0; margin: 0; }
	.tasks li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--line);
	}
	.tasks.snoozed li { opacity: 0.6; }
	.inline { display: inline-flex; margin: 0; }
	.title { flex: 1; }
	.dim { color: var(--muted); }
	.struck { text-decoration: line-through; color: var(--muted); }

	.check {
		width: 22px; height: 22px; padding: 0;
		border-radius: 50%; border: 2px solid var(--line);
		background: transparent; line-height: 1; font-size: 0.8rem;
		color: var(--green); flex-shrink: 0;
	}
	.check:hover { border-color: var(--green); }
	.check.on { border-color: var(--green); background: rgba(90,209,154,0.15); }
	.check.recur { color: var(--accent); border-color: var(--accent); font-size: 0.9rem; }
	.check.recur:hover { background: rgba(110,168,254,0.1); }
	.check.recur.dim { color: var(--muted); border-color: var(--line); }

	.recur-badge {
		font-size: 0.72rem;
		padding: 0.1rem 0.45rem;
		border: 1px solid var(--line);
		border-radius: 99px;
		color: var(--muted);
		white-space: nowrap;
		flex-shrink: 0;
	}
	.next-due { flex-shrink: 0; }

	.icon { border: none; background: transparent; padding: 0.2rem 0.35rem; color: var(--muted); flex-shrink: 0; }
	.icon.on { color: var(--accent); }
	.icon.del:hover { color: var(--hot); }

	.danger { margin-top: 2.5rem; }
	.danger .del { border-color: transparent; color: var(--muted); }
	.danger .del:hover { border-color: var(--hot); color: var(--hot); }
</style>
