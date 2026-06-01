// DB adapter router.
// Set DATABASE_URL to use Postgres/Neon. Omit it to use local SQLite.
// Both adapters export the exact same async API — nothing else in the app
// needs to know which one is running.

const adapter = process.env.DATABASE_URL
	? await import('./db-postgres.js')
	: await import('./db-sqlite.js');

export const {
	getSessionSecret,
	listProjects,
	statusCounts,
	createProject,
	getProject,
	setProjectStatus,
	deleteProject,
	listTasks,
	createTask,
	toggleTask,
	toggleStar,
	deleteTask
} = adapter;
