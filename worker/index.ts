export default {
	async fetch() {
		return new Response(null, { status: 404 });
	},
} satisfies ExportedHandler<Env>;
