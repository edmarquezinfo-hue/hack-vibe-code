import * as z from 'zod'

// --- Core File/Template Types ---

export const FileTreeNodeSchema: z.ZodType<any> = z.lazy(() => z.object({
    path: z.string(),
    type: z.enum(['file', 'directory']),
    children: z.array(FileTreeNodeSchema).optional(),
}))
export type FileTreeNode = z.infer<typeof FileTreeNodeSchema>

export const TemplateFileSchema = z.object({
    file_path: z.string(),
    file_contents: z.string(),
})
export type TemplateFile = z.infer<typeof TemplateFileSchema>

// --- Template Details ---

export const TemplateDetailsSchema = z.object({
    name: z.string(),
    description: z.object({
        selection: z.string(),
        usage: z.string(),
    }),
    fileTree: FileTreeNodeSchema,
    files: z.array(TemplateFileSchema),
    language: z.string().optional(),
    deps: z.record(z.string(), z.string()),
    frameworks: z.array(z.string()).optional(),
})
export type TemplateDetails = z.infer<typeof TemplateDetailsSchema>

// --- Instance Details ---

export const RuntimeErrorSchema = z.object({
    timestamp: z.union([z.string(), z.date()]),
    message: z.string(),
    stack: z.string().optional(),
    source: z.string().optional(),
    filePath: z.string().optional(),
    lineNumber: z.number().optional(),
    columnNumber: z.number().optional(),
    severity: z.enum(['warning', 'error', 'fatal']),
})
export type RuntimeError = z.infer<typeof RuntimeErrorSchema>

export const InstanceDetailsSchema = z.object({
    runId: z.string(),
    templateName: z.string(),
    startTime: z.union([z.string(), z.date()]),
    uptime: z.number(),
    previewURL: z.string().optional(),
    directory: z.string(),
    serviceDirectory: z.string(),
    fileTree: FileTreeNodeSchema.optional(),
    runtimeErrors: z.array(RuntimeErrorSchema).optional(),
})
export type InstanceDetails = z.infer<typeof InstanceDetailsSchema>

// --- Command Execution ---

export const CommandExecutionResultSchema = z.object({
    command: z.string(),
    success: z.boolean(),
    output: z.string(),
    error: z.string().optional(),
    exitCode: z.number().optional(),
})
export type CommandExecutionResult = z.infer<typeof CommandExecutionResultSchema>

// --- API Request/Response Schemas ---

// /templates (GET)
export const TemplateListResponseSchema = z.object({
    success: z.boolean(),
    templates: z.array(z.object({
        name: z.string(),
        language: z.string().optional(),
        frameworks: z.array(z.string()).optional(),
        description: z.object({
            selection: z.string(),
            usage: z.string(),
        })
    })),
    count: z.number(),
    error: z.string().optional(),
})
export type TemplateListResponse = z.infer<typeof TemplateListResponseSchema>

// /template/:name (GET)
export const TemplateDetailsResponseSchema = z.object({
    success: z.boolean(),
    templateDetails: TemplateDetailsSchema.optional(),
    error: z.string().optional(),
})
export type TemplateDetailsResponse = z.infer<typeof TemplateDetailsResponseSchema>

// /template/:name/files (POST)
export const GetTemplateFilesRequestSchema = z.object({
    filePaths: z.array(z.string()),
})
export type GetTemplateFilesRequest = z.infer<typeof GetTemplateFilesRequestSchema>

export const GetTemplateFilesResponseSchema = z.object({
    success: z.boolean(),
    files: z.array(TemplateFileSchema),
    errors: z.array(z.object({ file: z.string(), error: z.string() })).optional(),
    error: z.string().optional(),
})
export type GetTemplateFilesResponse = z.infer<typeof GetTemplateFilesResponseSchema>

// /instances (POST)
export const BootstrapRequestSchema = z.object({
    templateName: z.string(),
})
export type BootstrapRequest = z.infer<typeof BootstrapRequestSchema>

export const BootstrapResponseSchema = z.object({
    success: z.boolean(),
    runId: z.string().optional(),
    message: z.string().optional(),
    previewURL: z.string().optional(),
    tunnelURL: z.string().optional(),
    error: z.string().optional(),
})
export type BootstrapResponse = z.infer<typeof BootstrapResponseSchema>

// /instances (GET)
export const ListInstancesResponseSchema = z.object({
    success: z.boolean(),
    instances: z.array(InstanceDetailsSchema),
    count: z.number(),
    error: z.string().optional(),
})
export type ListInstancesResponse = z.infer<typeof ListInstancesResponseSchema>

// /instances/:id (GET)
export const GetInstanceResponseSchema = z.object({
    success: z.boolean(),
    instance: InstanceDetailsSchema.optional(),
    error: z.string().optional(),
})
export type GetInstanceResponse = z.infer<typeof GetInstanceResponseSchema>

// /instances/:id/files (POST)
export const WriteFilesRequestSchema = z.object({
    files: z.array(z.object({
        file_path: z.string(),
        file_contents: z.string(),
    })),
})
export type WriteFilesRequest = z.infer<typeof WriteFilesRequestSchema>

export const WriteFilesResponseSchema = z.object({
    success: z.boolean(),
    message: z.string().optional(),
    results: z.array(z.object({
        file: z.string(),
        success: z.boolean(),
        error: z.string().optional(),
    })),
    error: z.string().optional(),
})
export type WriteFilesResponse = z.infer<typeof WriteFilesResponseSchema>

// /instances/:id/commands (POST)
export const ExecuteCommandsRequestSchema = z.object({
    commands: z.array(z.string()),
    timeout: z.number().optional(),
})
export type ExecuteCommandsRequest = z.infer<typeof ExecuteCommandsRequestSchema>

export const ExecuteCommandsResponseSchema = z.object({
    success: z.boolean(),
    results: z.array(CommandExecutionResultSchema),
    message: z.string().optional(),
    error: z.string().optional(),
})
export type ExecuteCommandsResponse = z.infer<typeof ExecuteCommandsResponseSchema>

// /instances/:id/errors (GET)
export const RuntimeErrorResponseSchema = z.object({
    success: z.boolean(),
    errors: z.array(RuntimeErrorSchema),
    hasErrors: z.boolean(),
    error: z.string().optional(),
})
export type RuntimeErrorResponse = z.infer<typeof RuntimeErrorResponseSchema>

// /instances/:id/errors (DELETE)
export const ClearErrorsResponseSchema = z.object({
    success: z.boolean(),
    message: z.string().optional(),
    error: z.string().optional(),
})
export type ClearErrorsResponse = z.infer<typeof ClearErrorsResponseSchema>

// /instances/:id/fix-code (POST)
export const FixCodeResponseSchema = z.object({
    success: z.boolean(),
    message: z.string().optional(),
    fixes: z.array(z.object({
        filePath: z.string(),
        originalCode: z.string(),
        fixedCode: z.string(),
        explanation: z.string(),
    })),
    applied: z.array(z.string()).optional(),
    failed: z.array(z.string()).optional(),
    commands: z.array(z.string()).optional(),
    error: z.string().optional(),
})
export type FixCodeResponse = z.infer<typeof FixCodeResponseSchema>

// /instances/:id (DELETE)
export const ShutdownResponseSchema = z.object({
    success: z.boolean(),
    message: z.string().optional(),
    error: z.string().optional(),
})
export type ShutdownResponse = z.infer<typeof ShutdownResponseSchema>

// /templates/from-instance (POST)
export const PromoteToTemplateRequestSchema = z.object({
    instanceId: z.string(),
    templateName: z.string().optional(),
})
export type PromoteToTemplateRequest = z.infer<typeof PromoteToTemplateRequestSchema>

export const PromoteToTemplateResponseSchema = z.object({
    success: z.boolean(),
    message: z.string().optional(),
    templateName: z.string().optional(),
    error: z.string().optional(),
})
export type PromoteToTemplateResponse = z.infer<typeof PromoteToTemplateResponseSchema>

// /templates (POST) - AI template generation
export const GenerateTemplateRequestSchema = z.object({
    prompt: z.string(),
    templateName: z.string(),
    options: z.object({
        framework: z.string().optional(),
        language: z.enum(['javascript', 'typescript']).optional(),
        styling: z.enum(['tailwind', 'css', 'scss']).optional(),
        features: z.array(z.string()).optional(),
    }).optional(),
})
export type GenerateTemplateRequest = z.infer<typeof GenerateTemplateRequestSchema>

export const GenerateTemplateResponseSchema = z.object({
    success: z.boolean(),
    templateName: z.string(),
    summary: z.string().optional(),
    fileCount: z.number().optional(),
    fileTree: FileTreeNodeSchema.optional(),
    error: z.string().optional(),
})
export type GenerateTemplateResponse = z.infer<typeof GenerateTemplateResponseSchema>

// /instances/:id/lint (GET)
export const LintSeveritySchema = z.enum(['error', 'warning', 'info'])
export type LintSeverity = z.infer<typeof LintSeveritySchema>

export const CodeIssueSchema = z.object({
    message: z.string(),
    filePath: z.string(),
    line: z.number(),
    column: z.number().optional(),
    severity: LintSeveritySchema,
    ruleId: z.string().optional(),
    source: z.string().optional()
})
export type CodeIssue = z.infer<typeof CodeIssueSchema>

export const CodeIssuesResponseSchema = z.object({
    success: z.boolean(),
    lint: z.object({
        issues: z.array(CodeIssueSchema),
        summary: z.object({
            errorCount: z.number(),
            warningCount: z.number(),
            infoCount: z.number()
        }).optional(),
    }),
    typecheck: z.object({
        issues: z.array(CodeIssueSchema),
        summary: z.object({
            errorCount: z.number(),
            warningCount: z.number(),
            infoCount: z.number()
        }).optional(),
    }),
    error: z.string().optional()
})
export type StaticAnalysisResponse = z.infer<typeof CodeIssuesResponseSchema>
