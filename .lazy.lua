return {
	"stevearc/conform.nvim",
	opts = {
		formatters_by_ft = {
			javascript = { "oxfmt" },
			typescript = { "oxfmt" },
			javascriptreact = { "oxfmt" },
			typescriptreact = { "oxfmt" },
			html = { "oxfmt" },
			css = { "oxfmt" },
			json = { "oxfmt" },
			jsonc = { "oxfmt" },
			json5 = { "oxfmt" },
			yaml = { "oxfmt" },
			toml = { "oxfmt" },
			markdown = { "oxfmt" },
			vue = { "oxfmt" },

			-- some of these keys probably incorrect
			angular = { "oxfmt" },
			mdx = { "oxfmt" },
			graphql = { "oxfmt" },
			ember = { "oxfmt" },
			handlebars = { "oxfmt" },
		},
	},
}
