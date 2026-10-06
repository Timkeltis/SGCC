import unittest
from datetime import date
from types import SimpleNamespace

from sgcc_client.api import (
    StateGridAppApi,
    StateGridApiError,
    build_account_balance_payload,
    build_daily_usage_payload,
    build_meter_payload,
    build_monthly_bills_payload,
)


ACCOUNT = SimpleNamespace(
    cons_no="masked-destination-id",
    cons_no_src="opaque-source-id",
    pro_no="province-id",
    org_no="organization-id",
    cons_type="resident",
    elec_type="resident",
)


class RequestPayloadMappingTests(unittest.TestCase):
    def test_daily_usage_uses_account_source_identifier_as_cons_no(self):
        payload = build_daily_usage_payload(ACCOUNT, date(2026, 1, 1), date(2026, 1, 2))
        self.assertEqual(payload["data"]["consNo"], "opaque-source-id")
        self.assertEqual(payload["data"]["consNosrc"], "masked-destination-id")

    def test_monthly_bill_uses_account_source_identifier(self):
        payload = build_monthly_bills_payload(ACCOUNT, 2026)
        self.assertEqual(payload["data"]["consNo"], "opaque-source-id")

    def test_balance_and_meter_payloads_keep_their_existing_mapping(self):
        balance = build_account_balance_payload(ACCOUNT, "user-id")
        meter = build_meter_payload(ACCOUNT, date(2026, 1, 1))
        self.assertEqual(balance["data"]["list"][0]["consNo"], "masked-destination-id")
        self.assertEqual(balance["data"]["list"][0]["consNoSrc"], "opaque-source-id")
        self.assertEqual(meter["data"]["consNo"], "opaque-source-id")

    def test_gateway_success_without_business_payload_is_rejected(self):
        with self.assertRaises(StateGridApiError) as caught:
            StateGridAppApi._raise_for_error({"code": "0", "data": {}})
        self.assertEqual(caught.exception.code, "missing_business_data")

    def test_nonempty_business_data_is_accepted(self):
        result = StateGridAppApi._raise_for_error({"code": "0", "data": {"sevenEleList": [{"day": "2026-01-01"}]}})
        self.assertIn("sevenEleList", result)


if __name__ == "__main__":
    unittest.main()
