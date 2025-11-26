import re
from typing import List
from app.models.regex import RegexRule

class RegexService:
    def process(self, text: str, rules: List[RegexRule]) -> str:
        for rule in rules:
            if not rule.is_active:
                continue
            try:
                # Support $1, $2 backreferences
                text = re.sub(rule.pattern, rule.replacement, text)
            except re.error:
                # Log error or ignore invalid regex
                pass
        return text

regex_service = RegexService()
