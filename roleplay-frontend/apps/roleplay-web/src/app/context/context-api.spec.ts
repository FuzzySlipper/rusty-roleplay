import { mapContextUsageResponse } from './context-api';

describe('mapContextUsageResponse', () => {
  it('maps the rusty crew context endpoint shape', () => {
    const response = mapContextUsageResponse({
      session_id: 'session-1',
      provider: {
        display_name: 'Local',
        model_id: 'story-model',
        context_window_tokens: 128000,
        max_output_tokens: 4096,
      },
      context: {
        estimate_quality: 'sampled',
        estimate_method: 'debug',
        estimated_prompt_tokens: 12000,
        reserved_response_tokens: 4096,
        safety_margin_tokens: 2560,
        sampled_message_count: 14,
      },
    });

    expect(response.sessionId).toBe('session-1');
    expect(response.provider?.contextWindowTokens).toBe(128000);
    expect(response.provider?.maxOutputTokens).toBe(4096);
    expect(response.context.estimatedPromptTokens).toBe(12000);
    expect(response.context.sampledMessageCount).toBe(14);
  });

  it('accepts future explicit segment fields when they are present', () => {
    const response = mapContextUsageResponse({
      sessionId: 'session-2',
      context: {
        contextWindowTokens: 32000,
        loreTokens: 1000,
        systemPromptTokens: 2000,
        conversationHistoryTokens: 3000,
      },
    });

    expect(response.context.contextWindowTokens).toBe(32000);
    expect(response.context.loreTokens).toBe(1000);
    expect(response.context.systemTokens).toBe(2000);
    expect(response.context.historyTokens).toBe(3000);
  });
});
