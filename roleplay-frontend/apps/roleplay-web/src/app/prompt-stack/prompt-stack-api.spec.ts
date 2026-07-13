import { mapPromptStackPreview } from './prompt-stack-api';

describe('mapPromptStackPreview', () => {
  it('maps the rusty-crew prompt stack preview shape', () => {
    const preview = mapPromptStackPreview({
      session_id: 'session-a',
      profile_id: 'profile-a',
      promptContext: '# Core Behavior\nClean prose.',
      stack: {
        compiled_text: '# Core Behavior\nClean prose.',
        sections: [
          {
            id: 'core_behavior',
            title: 'Core Behavior',
            body: 'Clean prose.',
            source_kind: 'roleplay_runtime',
            source_id: 'session-a',
            inclusion_reason: 'base roleplay runtime guidance',
            token_estimate: 12,
            editable: false,
            derived: true,
          },
        ],
        trace: [
          {
            section_id: 'core_behavior',
            source_kind: 'roleplay_runtime',
            source_id: 'session-a',
            inclusion_reason: 'base roleplay runtime guidance',
            token_estimate: 12,
            editable: false,
            derived: true,
          },
        ],
        macro_resolutions: [
          {
            macro_name: '{{char}}',
            replacement: 'Xavier',
            occurrences: 2,
          },
        ],
        imported_prompt_blocks: [
          { source_kind: 'sillytavern_preset', source_id: 'preset' },
        ],
      },
    });

    expect(preview.sessionId).toBe('session-a');
    expect(preview.sections[0]).toMatchObject({
      id: 'core_behavior',
      editable: false,
      derived: true,
      tokenEstimate: 12,
    });
    expect(preview.trace[0]?.sectionId).toBe('core_behavior');
    expect(preview.macroResolutions[0]).toEqual({
      macroName: '{{char}}',
      replacement: 'Xavier',
      occurrences: 2,
    });
    expect(preview.importedPromptBlockCount).toBe(1);
  });
});
