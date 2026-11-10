package com.dike.assistant.application;

import java.util.Map;

public interface AiGateway {
  record Extraction(String action, String helpTopic, Map<String, String> fields, String answer) {
    public Extraction(String action, String helpTopic, Map<String, String> fields) {
      this(action, helpTopic, fields, "");
    }
  }

  Extraction extract(String text, String today, String kind, Map<String, String> fields);
}
