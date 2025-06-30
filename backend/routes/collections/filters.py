import logging
from datetime import datetime
from typing import List, Dict, Any

from qdrant_client.http import models

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

class FilterBuilder:
    """
    Converts Json filters to qdrant python client format.
    """

    def __init__(self):
        self.filter = models.Filter(
            must=[],
            should=[],
            must_not=[]
        )

    def add_must(self, conditions: List[Dict[str, Any]]):
        for condition in conditions:
            self.filter.must.append(self._create_field_condition(condition))
        return self

    def add_should(self, conditions: List[Dict[str, Any]]):
        for condition in conditions:
            self.filter.should.append(self._create_field_condition(condition))
        return self

    def add_must_not(self, conditions: List[Dict[str, Any]]):
        for condition in conditions:
            self.filter.must_not.append(self._create_field_condition(condition))
        return self

    def add_nested(self, nested_filter: 'FilterBuilder'):
        self.filter.must.append(nested_filter.build())
        return self

    def _create_field_condition(self, condition: Dict[str, Any]) -> models.FieldCondition:
        key = condition['key']
        value = condition['value']
        operator = condition.get('operator', 'match')

        if operator == 'match':
            return models.FieldCondition(
                key=key,
                match=models.MatchValue(value=value)
            )
        elif operator == 'range':
            range_params = {}
            for range_op, range_value in value.items():
                if isinstance(range_value, str) and self._is_date(range_value):
                    range_params[range_op] = self._date_to_timestamp(range_value)
                else:
                    range_params[range_op] = range_value
            return models.FieldCondition(
                key=key,
                range=models.Range(**range_params)
            )
        elif operator == 'geo_radius':
            return models.FieldCondition(
                key=key,
                geo_radius=models.GeoRadius(**value)
            )
        elif operator == 'geo_bounding_box':
            return models.FieldCondition(
                key=key,
                geo_bounding_box=models.GeoBoundingBox(**value)
            )
        else:
            raise ValueError(f"Unsupported operator: {operator}")

    def _is_date(self, value: str) -> bool:
        try:
            datetime.strptime(value, '%Y-%m-%d')
            return True
        except ValueError:
            return False

    def _date_to_timestamp(self, date_string: str) -> float:
        return datetime.strptime(date_string, '%Y-%m-%d').timestamp()

    def build(self) -> models.Filter:
        return self.filter

def create_filter(filter_params: Dict[str, Any]) -> models.Filter:
    """
    Create a Qdrant filter based on the provided parameters.

    Args:
        filter_params (Dict[str, Any]): The filter parameters.

    Returns:
        models.Filter: The constructed Qdrant filter.
    """
    builder = FilterBuilder()

    if 'must' in filter_params:
        builder.add_must(filter_params['must'])

    if 'should' in filter_params:
        builder.add_should(filter_params['should'])

    if 'must_not' in filter_params:
        builder.add_must_not(filter_params['must_not'])

    if 'nested' in filter_params:
        nested_builder = FilterBuilder()
        nested_builder.add_must(filter_params['nested'])
        builder.add_nested(nested_builder)

    return builder.build()