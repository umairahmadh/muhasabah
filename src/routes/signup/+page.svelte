<script>
	import { enhance } from '$app/forms';
	let { form } = $props();
</script>

<div class="screen">
	<form method="POST" use:enhance class="card">
		<div class="brand">muhasabah <span>✓</span></div>
		<p class="muted">Start your reckoning. One account, all your projects.</p>
		<input
			type="email"
			name="email"
			placeholder="email"
			value={form?.email ?? ''}
			autofocus
			autocomplete="email"
		/>
		<input type="password" name="password" placeholder="password (8+ chars)" autocomplete="new-password" />
		{#if form?.error}<p class="err">{form.error}</p>{/if}
		<button class="primary" type="submit">Create account</button>
		<p class="muted alt">Already have one? <a href="/login">Log in</a></p>
	</form>
</div>

<style>
	.screen { min-height: 100vh; display: grid; place-items: center; padding: 1.5rem; }
	.card {
		width: 100%; max-width: 340px;
		background: var(--panel); border: 1px solid var(--line);
		border-radius: var(--radius); padding: 1.6rem;
		display: flex; flex-direction: column; gap: 0.85rem;
	}
	.brand { font-size: 1.6rem; font-weight: 700; }
	.brand span { color: var(--green); }
	.err { color: var(--hot); margin: 0; font-size: 0.9rem; }
	.alt { text-align: center; font-size: 0.9rem; }
	.alt a { color: var(--accent); }
	p { margin: 0; }
</style>
