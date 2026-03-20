const webgpuHeadersPlugin = {
	name: 'webgpu-headers',
	configureServer(server) {
		server.middlewares.use((_req, res, next) => {
			res.setHeader('Permissions-Policy', 'webgpu=*');
			next();
		});
	},
};

const extraVitePlugins = [webgpuHeadersPlugin];

export default extraVitePlugins;
