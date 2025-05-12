# server.py
import os
import sqlite3
import json
from typing import Dict, List, Any, Optional, Literal, Union
from fastmcp import FastMCP, Context

# Initialize the FastMCP server
mcp = FastMCP("Conference Schedule API 🚀")

# Define absolute path to the database
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), 'schedule.db'))

# for claude desktop, see https://github.com/modelcontextprotocol/python-sdk/issues/263
@mcp.resource(
    uri="resource://schedule/schema",
    name="DatabaseSchema",
    description="Provides the complete schema of the conference schedule database including tables, columns, and relationships."
)
def get_schedule_schema() -> Dict[str, List[Dict[str, str]]]:
    """Returns the schema of the conference schedule database."""
    schema = {}
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Get list of tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    
    # For each table, get its column information
    for table in tables:
        table_name = table[0]
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = cursor.fetchall()
        
        schema[table_name] = [
            {
                "name": col[1],
                "type": col[2],
                "notnull": bool(col[3]),
                "default": col[4],
                "pk": bool(col[5])
            }
            for col in columns
        ]
    
    conn.close()
    return schema


@mcp.tool(
    name="GetDatabaseSchema",
    description="Retrieves the complete schema of the conference schedule database.",
)
def fetch_database_schema(table_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Retrieves the schema of the conference schedule database.
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    result = {}
    
    if table_name:
        # Get schema for specific table
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = cursor.fetchall()
        
        if not columns:
            conn.close()
            raise Exception(f"Table '{table_name}' not found in database")
        
        result[table_name] = {
            "columns": [
                {
                    "name": col[1],
                    "type": col[2],
                    "notnull": bool(col[3]),
                    "default_value": col[4],
                    "is_primary_key": bool(col[5])
                }
                for col in columns
            ]
        }
        
        # Get foreign keys
        cursor.execute(f"PRAGMA foreign_key_list({table_name})")
        foreign_keys = cursor.fetchall()
        
        if foreign_keys:
            result[table_name]["foreign_keys"] = [
                {
                    "id": fk[0],
                    "seq": fk[1],
                    "referenced_table": fk[2],
                    "from_column": fk[3],
                    "to_column": fk[4]
                }
                for fk in foreign_keys
            ]
    else:
        # Get all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        for table in tables:
            table_name = table[0]
            
            # Get columns
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = cursor.fetchall()
            
            table_info = {
                "columns": [
                    {
                        "name": col[1],
                        "type": col[2],
                        "notnull": bool(col[3]),
                        "default_value": col[4],
                        "is_primary_key": bool(col[5])
                    }
                    for col in columns
                ]
            }
            
            # Get foreign keys
            cursor.execute(f"PRAGMA foreign_key_list({table_name})")
            foreign_keys = cursor.fetchall()
            
            if foreign_keys:
                table_info["foreign_keys"] = [
                    {
                        "id": fk[0],
                        "seq": fk[1],
                        "referenced_table": fk[2],
                        "from_column": fk[3],
                        "to_column": fk[4]
                    }
                    for fk in foreign_keys
                ]
            
            result[table_name] = table_info
    
    conn.close()
    return result


@mcp.tool()
def add(a: int, b: int) -> int:
    """Adds two integer numbers together."""
    return a + b


@mcp.tool(
    name="QueryConferenceDatabase",
    description="Executes a read-only SELECT query against the conference schedule database.",
)
def query_database(sql_query: str) -> List[Dict[str, Any]]:
    """
    Executes a SELECT SQL query against the conference schedule database.
    """
    # Ensure the query is a SELECT query
    if not sql_query.strip().upper().startswith("SELECT"):
        raise Exception("Only SELECT queries are allowed for security reasons")
    
    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        # Enable dictionary cursor
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute(sql_query)
        rows = cursor.fetchall()
        
        # Convert sqlite3.Row objects to dictionaries
        results = [dict(row) for row in rows]
        conn.close()
        return results
    
    except Exception as e:
        if conn:
            conn.close()
        raise Exception(f"Database query error: {str(e)}")



if __name__ == "__main__":
    mcp.run()
