<script>
	import { enhance } from '$app/forms';
	let { form } = $props();
</script>

<div class="screen">
	<form method="POST" use:enhance class="card">
		<div class="brand">muhasabah <span>✓</span></div>
		<p class="muted">Your daily reckoning. One password, then in.</p>
		<input
			type="password"
			name="password"
			placeholder="password"
			autofocus
			autocomplete="current-password"
		/>
		{#if form?.error}<p class="err">{form.error}</p>{/if}
		<button class="primary" type="submit">Enter</button>
	</form>
</div>

<style>
	.screen {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 1.5rem;
	}
	.card {
		width: 100%;
		max-width: 340px;
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		padding: 1.6rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.brand {
		font-size: 1.6rem;
		font-weight: 700;
	}
	.brand span { color: var(--green); }
	.err { color: var(--hot); margin: 0; font-size: 0.9rem; }
	p { margin: 0; }
</style>
