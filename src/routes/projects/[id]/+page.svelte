<script>
	import { enhance } from '$app/forms';
	let { data } = $props();

	const open = $derived(data.tasks.filter((t) => !t.done));
	const done = $derived(data.tasks.filter((t) => t.done));
	const pct = $derived(data.tasks.length ? Math.round((done.length / data.tasks.length) * 100) : 0);
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
	<div class="muted small">{done.length}/{data.tasks.length} done · {pct}%</div>

	<form method="POST" action="?/addTask" use:enhance class="addtask">
		<input name="title" placeholder="Add a task…" autocomplete="off" autofocus />
		<button class="primary" type="submit">Add</button>
	</form>

	<ul class="tasks">
		{#each open as t (t.id)}
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

	{#if done.length}
		<div class="donehead muted small">done</div>
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

	.addtask { display: flex; gap: 0.5rem; margin: 1.25rem 0; }
	.addtask input { flex: 1; }

	.tasks { list-style: none; padding: 0; margin: 0; }
	.tasks li {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--line);
	}
	.inline { display: inline-flex; margin: 0; }
	.title { flex: 1; }
	.struck { text-decoration: line-through; color: var(--muted); }

	.check {
		width: 22px; height: 22px; padding: 0;
		border-radius: 50%; border: 2px solid var(--line);
		background: transparent; line-height: 1; font-size: 0.8rem;
		color: var(--green);
	}
	.check:hover { border-color: var(--green); }
	.check.on { border-color: var(--green); background: rgba(90,209,154,0.15); }

	.icon { border: none; background: transparent; padding: 0.2rem 0.35rem; color: var(--muted); }
	.icon.on { color: var(--accent); }
	.icon.del:hover { color: var(--hot); }

	.donehead { margin: 1.5rem 0 0.3rem; text-transform: uppercase; letter-spacing: 0.06em; }

	.danger { margin-top: 2.5rem; }
	.danger .del { border-color: transparent; color: var(--muted); }
	.danger .del:hover { border-color: var(--hot); color: var(--hot); }
</style>
